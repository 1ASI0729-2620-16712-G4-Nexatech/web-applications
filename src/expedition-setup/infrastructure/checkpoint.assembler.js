import { Checkpoint } from '../domain/model/checkpoint.entity.js';

/**
 * Maps Checkpoint resources into Checkpoint domain entities.
 */
export class CheckpointAssembler {
    static toEntityFromResource(resource) {
        return new Checkpoint({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data.checkpoints;

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}