import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

export class PreparationApi extends BaseApi {
    constructor() {
        super();
        this.preparations = new BaseEndpoint(this, '/participant-preparations');
        this.wearables = new BaseEndpoint(this, '/wearable-devices');
        this.notes = new BaseEndpoint(this, '/route-notes');
        this.protocols = new BaseEndpoint(this, '/safety-protocols');
        this.groups = new BaseEndpoint(this, '/expedition-groups');
        this.guides = new BaseEndpoint(this, '/field-guides');
    }
}
