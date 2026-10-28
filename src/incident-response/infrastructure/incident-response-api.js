import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';
export class IncidentResponseApi extends BaseApi {
    constructor() {
        super();
        this.incidents = new BaseEndpoint(this, '/incidents');
        this.notifications = new BaseEndpoint(this, '/notifications');
        this.evacuations = new BaseEndpoint(this, '/evacuation-actions');
        this.rescues = new BaseEndpoint(this, '/rescue-coordinations');
    }
}
