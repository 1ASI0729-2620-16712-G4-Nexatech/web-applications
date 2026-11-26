import { requireCondition } from '../../../shared/domain/application-error.js';

/** Maximum readings and passages accepted by the API in one batch. */
export const SYNC_BATCH_LIMIT = 500;

const syncableKinds = new Set(['telemetry', 'check-in']);

/** Returns whether a queued record can travel in a sync batch of the session. Other kinds are never touched. */
export function isSyncable(record, sessionId) {
    return syncableKinds.has(record.kind) && record.sessionId === sessionId && !record.rejection;
}

/**
 * Offline readings and passages of one tracking session sent together from a checkpoint. The clientBatchId is
 * generated once and reused on every retry of the same batch.
 */
export class SyncBatch {
    constructor({ clientBatchId = crypto.randomUUID(), sessionId, checkpointId, records = [], createdAt = new Date().toISOString() }) {
        Object.assign(this, { clientBatchId, sessionId, checkpointId, records, createdAt });
    }

    /** Reserves space for arrivals the server needs and fills the rest in capture order. */
    static fromQueue(sessionId, checkpointId, queued, requiredCheckpointIds = []) {
        const ordered = queued.filter((record) => isSyncable(record, sessionId))
            .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
        const earliestArrivals = new Map();
        for (const record of ordered) {
            if (record.kind === 'check-in' && !earliestArrivals.has(record.checkpointId)) {
                earliestArrivals.set(record.checkpointId, record);
            }
        }
        const requiredArrivals = new Set(requiredCheckpointIds.map((id) => earliestArrivals.get(id)));
        requireCondition(!requiredArrivals.has(undefined) && requiredArrivals.size <= SYNC_BATCH_LIMIT,
            'workflow.errors.checkpointOrder');

        let remainingSlots = SYNC_BATCH_LIMIT - requiredArrivals.size;
        const records = ordered.filter((record) => {
            if (requiredArrivals.has(record)) return true;
            if (remainingSlots === 0) return false;
            remainingSlots -= 1;
            return true;
        });
        return new SyncBatch({ sessionId, checkpointId, records });
    }

    get recordIds() { return this.records.map((record) => record.clientRecordId); }

    validate(checkpoints) {
        requireCondition(Number.isInteger(this.sessionId) && this.sessionId > 0, 'workflow.errors.notActive');
        requireCondition(checkpoints.some((checkpoint) => checkpoint.id === this.checkpointId), 'workflow.errors.checkpoint');
        requireCondition(this.records.length > 0, 'workflow.errors.emptyQueue');
        requireCondition(new Set(this.recordIds).size === this.records.length
            && this.records.every((record) => typeof record.clientRecordId === 'string' && record.clientRecordId));
    }
}
