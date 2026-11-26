/**
 * Result persisted by the API for a sync batch. Only accepted and duplicate identifiers are confirmed: those are the
 * only records the client may remove from its queue.
 */
export class SyncBatchResult {
    constructor({ batchId, clientBatchId, sessionId, checkpointId, receivedAt, acceptedRecordIds, duplicateRecordIds,
        rejectedRecords, evaluationStatus }) {
        Object.assign(this, {
            batchId, clientBatchId, sessionId, checkpointId, receivedAt,
            acceptedRecordIds, duplicateRecordIds, rejectedRecords, evaluationStatus,
        });
    }

    get confirmedRecordIds() { return [...this.acceptedRecordIds, ...this.duplicateRecordIds]; }
}
