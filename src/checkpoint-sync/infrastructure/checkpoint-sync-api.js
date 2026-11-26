import { BaseApi } from '../../shared/infrastructure/base-api.js';

/** REST gateway for the Checkpoint Sync batches of the VitalTrek RESTful API. */
export class CheckpointSyncApi extends BaseApi {
    /** Sends a batch; an identical retry with the same clientBatchId returns the persisted result (202). */
    submitBatch(resource) {
        return this.http.post('/sync-batches', resource);
    }

    /** Reads the persisted result of a batch. */
    getBatch(batchId) {
        return this.http.get(`/sync-batches/${batchId}`);
    }
}
