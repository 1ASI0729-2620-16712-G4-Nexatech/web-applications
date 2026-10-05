import { ManifestEntry } from '../domain/model/manifest-entry.entity.js';

/**
 * Maps Manifest Entry resources into Manifest Entry domain entities.
 */
export class ManifestEntryAssembler {
    static toEntityFromResource(resource) {
        return new ManifestEntry({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data['manifest-entries'];

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}
