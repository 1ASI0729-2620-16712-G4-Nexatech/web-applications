import { BaseApi } from '../../shared/infrastructure/base-api.js';

/** REST gateway for persisted field tracking progress. */
export class FieldTrackingApi extends BaseApi {
    getGroupProgress(groupId) {
        return this.http.get(`/expedition-groups/${groupId}/tracking-progress`);
    }
}
