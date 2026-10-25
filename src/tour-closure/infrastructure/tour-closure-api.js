import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';
export class TourClosureApi extends BaseApi {
    constructor() {
        super();
        this.closures = new BaseEndpoint(this, '/tour-closures');
        this.summaries = new BaseEndpoint(this, '/tour-summaries');
        this.groups = new BaseEndpoint(this, '/expedition-groups');
        this.preparations = new BaseEndpoint(this, '/participant-preparations');
        this.wearables = new BaseEndpoint(this, '/wearable-devices');
    }
}
