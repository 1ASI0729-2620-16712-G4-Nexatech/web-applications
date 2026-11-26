import { BaseApi } from '../../shared/infrastructure/base-api.js';

export class ExpeditionExecutionApi extends BaseApi {
    startTrackingSession(expeditionGroupId) {
        return this.http.post('/tracking-sessions', { expeditionGroupId });
    }
}
