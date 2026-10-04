import {
    ExpectedTimeWindow,
} from '../domain/model/expected-time-window.entity.js';

/**
 * Maps Expected Time Window resources into domain entities.
 */
export class ExpectedTimeWindowAssembler {
    static toEntityFromResource(resource) {
        return new ExpectedTimeWindow({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data['expected-time-windows'];

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}