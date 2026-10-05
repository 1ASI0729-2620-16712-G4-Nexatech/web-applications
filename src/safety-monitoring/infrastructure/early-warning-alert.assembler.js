import { EarlyWarningAlert } from '../domain/model/early-warning-alert.entity.js';

/**
 * Maps Early Warning Alert resources into Early Warning Alert domain entities.
 */
export class EarlyWarningAlertAssembler {
    static toEntityFromResource(resource) {
        return new EarlyWarningAlert({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data['early-warning-alerts'];

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}
