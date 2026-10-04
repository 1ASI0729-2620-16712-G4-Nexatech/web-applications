import { GroupProgress } from '../domain/model/group-progress.entity.js';

/**
 * Maps Group Progress resources into Group Progress domain entities.
 */
export class GroupProgressAssembler {
    static toEntityFromResource(resource) {
        return new GroupProgress({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data['group-progress'];

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}
