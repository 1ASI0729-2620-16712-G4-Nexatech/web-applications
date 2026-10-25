import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

export class ExpeditionExecutionApi extends BaseApi {
    constructor() {
        super();
        this.groups = new BaseEndpoint(this, '/expedition-groups');
        this.checkIns = new BaseEndpoint(this, '/check-ins');
    }
}
