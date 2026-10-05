import { FieldGuide } from '../domain/model/field-guide.entity.js';

/**
 * Maps Field Guide resources into Field Guide domain entities.
 */
export class FieldGuideAssembler {
    static toEntityFromResource(resource) {
        return new FieldGuide({ ...resource });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data['field-guides'];

        return resources.map((resource) => (
            this.toEntityFromResource(resource)
        ));
    }
}
