import { SyncBatchResult } from '../domain/model/sync-batch-result.entity.js';

const isText = (value) => typeof value === 'string' && value.length > 0;
const isIdList = (value) => Array.isArray(value) && value.every(isText);

/** Maps queued offline records to the H0 sync batch contract and the API result back to the client model. */
export class SyncBatchAssembler {
    /** Contract: clientBatchId, sessionId, checkpointId, readings and passages; agency and guide come from the token. */
    static toResourceFromEntity(batch) {
        return {
            clientBatchId: batch.clientBatchId,
            sessionId: batch.sessionId,
            checkpointId: batch.checkpointId,
            readings: batch.records.filter((record) => record.kind === 'telemetry').map((record) => ({
                clientRecordId: record.clientRecordId,
                wearableDeviceId: record.wearableDeviceId,
                recordedAt: record.recordedAt,
                latitude: record.latitude,
                longitude: record.longitude,
                altitude: record.altitude,
                heartRate: record.heartRate,
                battery: record.battery,
                deviationMeters: record.deviationMeters,
            })),
            passages: batch.records.filter((record) => record.kind === 'check-in').map((record) => ({
                clientRecordId: record.clientRecordId,
                checkpointId: record.checkpointId,
                passedAt: record.passedAt ?? record.recordedAt,
            })),
        };
    }

    /** Returns null when the response does not confirm the records, so nothing is removed from the queue. */
    static toResultFromResource(resource) {
        if (!resource || !Number.isInteger(resource.batchId) || !isText(resource.clientBatchId)
            || !isIdList(resource.acceptedRecordIds) || !isIdList(resource.duplicateRecordIds)
            || !Array.isArray(resource.rejectedRecords)
            || !resource.rejectedRecords.every((record) => isText(record?.clientRecordId) && isText(record.code)))
            return null;
        return new SyncBatchResult({
            batchId: resource.batchId,
            clientBatchId: resource.clientBatchId,
            sessionId: resource.sessionId,
            checkpointId: resource.checkpointId,
            receivedAt: resource.receivedAt,
            acceptedRecordIds: [...resource.acceptedRecordIds],
            duplicateRecordIds: [...resource.duplicateRecordIds],
            rejectedRecords: resource.rejectedRecords.map(({ clientRecordId, code }) => ({ clientRecordId, code })),
            evaluationStatus: resource.evaluationStatus,
        });
    }

    /** i18n key of a stable API rejection code; dots are path separators for vue-i18n. */
    static toMessageKey(code) {
        return `workflow.syncCodes.${String(code).replaceAll('.', '_')}`;
    }
}
