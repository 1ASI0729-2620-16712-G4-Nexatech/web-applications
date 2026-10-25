import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

export class CheckpointSyncApi extends BaseApi {
    constructor() {
        super();
        this.batches = new BaseEndpoint(this, '/sync-batches');
        this.telemetry = new BaseEndpoint(this, '/telemetry-records');
        this.checkIns = new BaseEndpoint(this, '/check-ins');
        this.progress = new BaseEndpoint(this, '/group-progress');
    }
}
