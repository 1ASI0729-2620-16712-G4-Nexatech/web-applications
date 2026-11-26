import { ref } from 'vue';
import { defineStore } from 'pinia';
import { CheckpointSyncApi } from '../infrastructure/checkpoint-sync-api.js';
import { SyncBatchAssembler } from '../infrastructure/sync-batch.assembler.js';
import { SyncBatch, isSyncable } from '../domain/model/sync-batch.entity.js';
import { createActionState } from '../../shared/application/action-state.js';
import { ApplicationError, requireCondition } from '../../shared/domain/application-error.js';
import {
    legacyRecords, markRejected, migrateLegacyQueue, readLocal, removeRecords, scopeKey, scopedRecords, writeLocal,
} from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import useFieldTrackingStore from '../../field-tracking/application/field-tracking.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

const api = new CheckpointSyncApi();
const HISTORY_LIMIT = 20;

const batchErrorCodes = {
    'SyncBatch.RecordIdentityConflict': 'workflow.errors.syncRecordConflict',
    'SyncBatch.BatchIdentityConflict': 'workflow.errors.syncBatchConflict',
    'SyncBatch.SessionNotActive': 'workflow.errors.notActive',
    'SyncBatch.SessionNotFound': 'workflow.errors.notFound',
    'SyncBatch.CheckpointNotInSessionRoute': 'workflow.errors.checkpoint',
};

function pendingKey(scope) { return `${scopeKey(scope)}-pending-batch`; }
function historyKey(scope) { return `${scopeKey(scope)}-history`; }

/** No response, a server failure or an expired token leave the batch pending: it is resent with the same identity. */
function isRetryable(error) {
    const status = error?.response?.status;
    return !error?.response || status >= 500 || [401, 408, 429].includes(status);
}

/** Runs the send once per scope across tabs when the browser supports Web Locks. */
async function withScopeLock(key, action) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks?.request) return action();
    return locks.request(`vitaltrek-sync-${key}`, { ifAvailable: true }, (lock) => {
        if (!lock) throw new ApplicationError('workflow.errors.syncInProgress');
        return action();
    });
}

export default defineStore('checkpointSync', () => {
    const iam = useIamStore();
    const tracking = useFieldTrackingStore();
    const revision = ref(0);
    /** Readings confirmed by the server in this browser session; input of the demonstration safety rules. */
    const telemetry = ref([]);
    const online = ref(typeof navigator === 'undefined' || navigator.onLine !== false);
    const sending = new Set();
    const state = createActionState();

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => { online.value = true; });
        window.addEventListener('offline', () => { online.value = false; });
    }

    function isGuide(group) {
        return iam.user?.role === Roles.GUIDE && Boolean(iam.user.fieldGuideId) && canAccessGroup(iam.user, group);
    }

    /** The queue of the signed-in guide for the tracking session the server confirmed for this group. */
    function scopeFor(group) {
        const sessionId = tracking.entries[group.id]?.session?.sessionId;
        if (!isGuide(group) || !Number.isInteger(sessionId)) return null;
        return { agencyId: group.agencyId, userId: iam.user.id, expeditionGroupId: group.id, sessionId };
    }

    function read(group, key, fallback) {
        void revision.value;
        const scope = scopeFor(group);
        return scope ? readLocal(key(scope), fallback) : fallback;
    }

    function records(group) {
        void revision.value;
        const scope = scopeFor(group);
        return scope ? scopedRecords(scope) : [];
    }

    const pendingBatch = (group) => read(group, pendingKey, null);
    const history = (group) => read(group, historyKey, []);
    const lastReceivedAt = (group) => history(group)[0]?.receivedAt ?? null;
    const pendingCount = (group) => {
        const scope = scopeFor(group);
        return scope ? records(group).filter((record) => isSyncable(record, scope.sessionId)).length : 0;
    };
    const rejectedRecords = (group) => records(group).filter((record) => record.rejection);
    const legacyCount = (group) => { void revision.value; return isGuide(group) ? legacyRecords(group.agencyId, group.id).length : 0; };

    function rememberResult(scope, result, resource) {
        const confirmed = new Set(result.confirmedRecordIds);
        const sent = new Set([...resource.readings, ...resource.passages].map((record) => record.clientRecordId));
        // Only identities this batch carried and the server confirmed leave the queue.
        removeRecords(scope.agencyId, [...confirmed].filter((id) => sent.has(id)));
        markRejected(scope, result.rejectedRecords.filter((record) => sent.has(record.clientRecordId))
            .map((record) => ({ ...record, batchId: result.batchId })));
        const previous = readLocal(historyKey(scope), []).filter((item) => item.batchId !== result.batchId);
        writeLocal(historyKey(scope), [{ ...result }, ...previous].slice(0, HISTORY_LIMIT));
        const known = new Set(telemetry.value.map((reading) => reading.clientRecordId));
        telemetry.value = [...telemetry.value, ...resource.readings
            .filter((reading) => confirmed.has(reading.clientRecordId) && !known.has(reading.clientRecordId))
            .map((reading) => ({ ...reading, expeditionGroupId: scope.expeditionGroupId, sessionId: scope.sessionId }))];
        writeLocal(pendingKey(scope), null);
    }

    async function send(scope, checkpoint, checkpoints) {
        migrateLegacyQueue(scope.agencyId);
        let pending = readLocal(pendingKey(scope), null);
        if (!pending) {
            const batch = SyncBatch.fromQueue(scope.sessionId, checkpoint?.id, scopedRecords(scope));
            batch.validate(checkpoints);
            pending = {
                clientBatchId: batch.clientBatchId, checkpointId: batch.checkpointId, createdAt: batch.createdAt,
                attempts: 0, resource: SyncBatchAssembler.toResourceFromEntity(batch),
            };
        }
        // Saved before sending, so a reload or a lost response retries the same batch instead of creating a new one.
        pending = { ...pending, attempts: pending.attempts + 1, lastAttemptAt: new Date().toISOString() };
        writeLocal(pendingKey(scope), pending);

        let response;
        try {
            response = await api.submitBatch(pending.resource);
        } catch (error) {
            if (isRetryable(error)) {
                throw new ApplicationError(error?.response?.status === 401 ? 'workflow.errors.sessionExpired' : 'workflow.errors.syncRetry');
            }
            // The API rejected the whole batch and stored nothing: records stay queued and a new batch is built later.
            writeLocal(pendingKey(scope), null);
            throw new ApplicationError(batchErrorCodes[error.response.data?.code] ?? 'workflow.errors.syncFailed');
        }

        const result = SyncBatchAssembler.toResultFromResource(response.data);
        requireCondition(response.status === 202 && result?.clientBatchId === pending.clientBatchId,
            'workflow.errors.syncUnconfirmed');
        rememberResult(scope, result, pending.resource);
        return result;
    }

    function synchronize(group, checkpoint, checkpoints = []) {
        return state.run(async () => {
            requireCondition(isGuide(group), 'workflow.errors.forbidden');
            requireCondition(tracking.entries[group.id]?.session?.status === 'active', 'workflow.errors.notActive');
            const scope = scopeFor(group);
            requireCondition(scope, 'workflow.errors.notActive');
            const key = scopeKey(scope);
            requireCondition(!sending.has(key), 'workflow.errors.syncInProgress');
            sending.add(key);
            try {
                return await withScopeLock(key, () => send(scope, checkpoint, checkpoints));
            } finally {
                sending.delete(key);
                revision.value += 1;
            }
        });
    }

    /** Reads the persisted result again, for example to show the detail of a batch received on another device. */
    function refreshBatch(group, batchId) {
        return state.run(async () => {
            const scope = scopeFor(group);
            requireCondition(scope, 'workflow.errors.forbidden');
            const result = SyncBatchAssembler.toResultFromResource((await api.getBatch(batchId)).data);
            requireCondition(result, 'workflow.errors.syncUnconfirmed');
            const updated = readLocal(historyKey(scope), []).map((item) => item.batchId === batchId ? { ...result } : item);
            writeLocal(historyKey(scope), updated);
            revision.value += 1;
            return result;
        });
    }

    /** Removes a rejected record only on an explicit decision of the guide. */
    function discardRejected(group, clientRecordId) {
        const scope = scopeFor(group);
        requireCondition(scope, 'workflow.errors.forbidden');
        requireCondition(scopedRecords(scope).some((record) => record.id === clientRecordId && record.rejection));
        removeRecords(scope.agencyId, [clientRecordId]);
        revision.value += 1;
    }

    /** Batch results are read per group from this device; kept for the workspace refresh contract. */
    async function load() {
        revision.value += 1;
    }

    return {
        telemetry, online, revision, load, synchronize, refreshBatch, discardRejected, pendingBatch, history,
        lastReceivedAt, pendingCount, rejectedRecords, legacyCount, isSending: (group) => {
            const scope = scopeFor(group);
            return Boolean(scope && sending.has(scopeKey(scope))) || state.pending.value > 0;
        },
        pending: state.pending, error: state.error,
    };
});
