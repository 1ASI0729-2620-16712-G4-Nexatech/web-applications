import { SyncBatch } from '../domain/model/sync-batch.entity.js';
export class SyncBatchAssembler {
    static toEntityFromResource(resource) { return new SyncBatch(resource); }
    static toEntitiesFromResponse(response) { return response.data.map((item) => this.toEntityFromResource(item)); }
}
