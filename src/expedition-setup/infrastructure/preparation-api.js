import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const preparationsPath = '/participant-preparations';

export class PreparationApi extends BaseApi {
    constructor() {
        super();
        this.preparations = new BaseEndpoint(this, preparationsPath);
        this.wearables = new BaseEndpoint(this, '/wearable-devices');
        this.notes = new BaseEndpoint(this, '/route-notes');
        this.protocols = new BaseEndpoint(this, '/safety-protocols');
        this.groups = new BaseEndpoint(this, '/expedition-groups');
        this.guides = new BaseEndpoint(this, '/field-guides');
    }

    assignWearable(preparationId, wearableDeviceId) {
        return this.http.put(`${preparationsPath}/${preparationId}/wearable-assignment`, { wearableDeviceId });
    }

    registerEmergencyContact(preparationId, contact) {
        return this.http.put(`${preparationsPath}/${preparationId}/emergency-contact`, contact);
    }

    /** Saves or clears the optional health information of the authenticated tourist. */
    registerHealthInformation(preparationId, healthNotes) {
        return this.http.put(`${preparationsPath}/${preparationId}/health-information`, { healthNotes });
    }

    updateConsent(preparationId, granted) {
        return this.http.put(`${preparationsPath}/${preparationId}/consent`, { granted });
    }
}
