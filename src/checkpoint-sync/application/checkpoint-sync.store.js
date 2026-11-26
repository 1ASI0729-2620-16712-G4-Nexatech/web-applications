import { ref } from 'vue';
import { defineStore } from 'pinia';
import { CheckpointSyncApi } from '../infrastructure/checkpoint-sync-api.js';
import { SyncBatchAssembler } from '../infrastructure/sync-batch.assembler.js';
import { SyncBatch, isSyncable } from '../domain/model/sync-batch.entity.js';
import { createActionState } from '../../shared/application/action-state.js';
import { ApplicationError, requireCondition } from '../../shared/domain/application-error.js';
import {
    legacyRecords, markRejected, migrateLegacyQueue, readLocal, removeRecords, scopeKey, scopedRecords, scopesFor, writeLocal,
} from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import useFieldTrackingStore from '../../field-tracking/application/field-tracking.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

const api = new CheckpointSyncApi();
const HISTORY_LIMIT = 20;

const batchErrorCodes = {
    'SyncBatch.RecordIdentityConflict': 'workflow.errors.syncRecordConflict',
    'SyncBatch.BatchIdentityConflict': 'workflow.errors.syncBatchConflict',
    'SyncBatch.CheckpointArrivalRequired': 'workflow.errors.checkpointArrival',
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
    // An async callback turns every failure into a rejection, so the lock is always released.
    return locks.request(`vitaltrek-sync-${key}`, { ifAvailable: true }, async (lock) => {
        if (!lock) throw new ApplicationError('workflow.errors.syncInProgress');
        return await action();
    });
}

export default defineStore('checkpointSync', () => {
    const iam = useIamStore();
    const tracking = useFieldTrackingStore();
    const revision = ref(0);
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
    function currentScope(group) {
        const sessionId = tracking.entries[group.id]?.session?.sessionId;
        if (!isGuide(group) || !Number.isInteger(sessionId)) return null;
        return { agencyId: group.agencyId, userId: iam.user.id, expeditionGroupId: group.id, sessionId };
    }

    /** Every queue of the guide in this group, including sessions that already ended. */
    function guideScopes(group) {
        void revision.value;
        if (!isGuide(group)) return [];
        const scopes = scopesFor(group.agencyId, iam.user.id, group.id);
        const current = currentScope(group);
        return current && !scopes.some((scope) => scope.sessionId === current.sessionId) ? [...scopes, current] : scopes;
    }

    /**
     * A batch saved before sending, of any session of the guide in this group. It is always recoverable with the same
     * clientBatchId, even after the expedition closed: the server answers a stored batch before checking the session.
     */
    function findPending(group) {
        for (const scope of guideScopes(group)) {
            const batch = readLocal(pendingKey(scope), null);
            if (batch) return { scope, batch };
        }
        return null;
    }

    /** Moves captures saved by an earlier version of the queue; runs when Synchronization opens. */
    function prepare(group) {
        if (!isGuide(group)) return;
        migrateLegacyQueue(group.agencyId);
        revision.value += 1;
    }

    function currentRecords(group) {
        void revision.value;
        const scope = currentScope(group);
        return scope ? scopedRecords(scope) : [];
    }

    function confirmedArrivalIds(group, scope) {
        const progress = tracking.entries[group.id]?.progress;
        const confirmed = scope && progress?.sessionId === scope.sessionId ? progress.confirmedCheckpoints : [];
        return new Set(confirmed.map((checkpoint) => checkpoint.checkpointId));
    }

    /** Checkpoints with a confirmed or pending arrival in this session. */
    function arrivalCheckpointIds(group) {
        const scope = currentScope(group);
        const arrivals = confirmedArrivalIds(group, scope);
        if (!scope) return arrivals;
        for (const record of currentRecords(group)) {
            if (record.kind === 'check-in' && isSyncable(record, scope.sessionId)) {
                arrivals.add(record.checkpointId);
            }
        }
        return arrivals;
    }

    const syncCheckpoints = (group, checkpoints) => {
        const arrivals = arrivalCheckpointIds(group);
        const firstMissing = checkpoints.findIndex((checkpoint) => !arrivals.has(checkpoint.id));
        return firstMissing === -1 ? checkpoints : checkpoints.slice(0, firstMissing);
    };
    const pendingBatch = (group) => findPending(group)?.batch ?? null;
    const history = (group) => guideScopes(group).flatMap((scope) => readLocal(historyKey(scope), []))
        .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt))).slice(0, HISTORY_LIMIT);
    const lastReceivedAt = (group) => history(group)[0]?.receivedAt ?? null;
    const pendingCount = (group) => {
        const scope = currentScope(group);
        return scope ? currentRecords(group).filter((record) => isSyncable(record, scope.sessionId)).length : 0;
    };
    const rejectedRecords = (group) => guideScopes(group).flatMap((scope) => scopedRecords(scope))
        .filter((record) => record.rejection);
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
        writeLocal(pendingKey(scope), null);
    }

    function newBatch(group, scope, checkpoint, checkpoints) {
        requireCondition(tracking.entries[group.id]?.session?.status === 'active', 'workflow.errors.notActive');
        const checkpointIndex = checkpoints.findIndex((item) => item.id === checkpoint?.id);
        requireCondition(checkpointIndex >= 0, 'workflow.errors.checkpoint');
        requireCondition(arrivalCheckpointIds(group).has(checkpoint.id), 'workflow.errors.checkpointArrival');
        const confirmed = confirmedArrivalIds(group, scope);
        const requiredCheckpointIds = confirmed.has(checkpoint.id) ? [] : checkpoints.slice(0, checkpointIndex + 1)
            .map((item) => item.id).filter((id) => !confirmed.has(id));
        const batch = SyncBatch.fromQueue(scope.sessionId, checkpoint.id, scopedRecords(scope), requiredCheckpointIds);
        batch.validate(checkpoints);
        return {
            clientBatchId: batch.clientBatchId, checkpointId: batch.checkpointId, createdAt: batch.createdAt,
            attempts: 0, resource: SyncBatchAssembler.toResourceFromEntity(batch),
        };
    }

    async function send(scope, pending) {
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
            migrateLegacyQueue(group.agencyId);
            const recovery = findPending(group);
            const scope = recovery?.scope ?? currentScope(group);
            requireCondition(scope, 'workflow.errors.notActive');
            const key = scopeKey(scope);
            requireCondition(!sending.has(key), 'workflow.errors.syncInProgress');
            sending.add(key);
            try {
                return await withScopeLock(key, async () => send(scope,
                    readLocal(pendingKey(scope), null) ?? newBatch(group, scope, checkpoint, checkpoints)));
            } finally {
                sending.delete(key);
                revision.value += 1;
            }
        });
    }

    /** Reads the persisted result again, for example to show the detail of a batch received on another device. */
    function refreshBatch(group, batchId) {
        return state.run(async () => {
            requireCondition(isGuide(group), 'workflow.errors.forbidden');
            const result = SyncBatchAssembler.toResultFromResource((await api.getBatch(batchId)).data);
            requireCondition(result, 'workflow.errors.syncUnconfirmed');
            for (const scope of guideScopes(group)) {
                const items = readLocal(historyKey(scope), []);
                if (items.some((item) => item.batchId === batchId))
                    writeLocal(historyKey(scope), items.map((item) => item.batchId === batchId ? { ...result } : item));
            }
            revision.value += 1;
            return result;
        });
    }

    /** Removes a rejected record only on an explicit decision of the guide. */
    function discardRejected(group, clientRecordId) {
        requireCondition(rejectedRecords(group).some((record) => record.id === clientRecordId));
        removeRecords(group.agencyId, [clientRecordId]);
        revision.value += 1;
    }

    /** Batch results are read per group from this device; kept for the workspace refresh contract. */
    async function load() {
        revision.value += 1;
    }

    return {
        online, revision, load, prepare, synchronize, refreshBatch, discardRejected, pendingBatch, history,
        lastReceivedAt, pendingCount, rejectedRecords, legacyCount, syncCheckpoints,
        isSending: (group) => guideScopes(group).some((scope) => sending.has(scopeKey(scope))) || state.pending.value > 0,
        pending: state.pending, error: state.error,
    };
});
