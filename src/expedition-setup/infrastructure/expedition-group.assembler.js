import { ExpeditionGroup } from '../domain/model/expedition-group.entity.js';

/**
 * Maps Expedition Group resources into Expedition Group domain entities.
 */
export class ExpeditionGroupAssembler {
    static toEntityFromResource(resource) {
        return new ExpeditionGroup({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data['expedition-groups'];

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}
