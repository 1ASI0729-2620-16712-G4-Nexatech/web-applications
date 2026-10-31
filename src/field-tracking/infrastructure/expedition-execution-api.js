import { SimulatedApi } from '../../shared/infrastructure/simulated-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

export class ExpeditionExecutionApi extends SimulatedApi {
    constructor() {
        super();
        this.groups = new BaseEndpoint(this, '/expedition-groups');
        this.checkIns = new BaseEndpoint(this, '/check-ins');
    }
}
