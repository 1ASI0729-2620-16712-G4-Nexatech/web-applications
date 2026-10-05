/**
 * Field Guide entity within the Expedition Setup bounded context.
 */
export class FieldGuide {
    /**
     * @param {Object} params - Field Guide attributes.
     * @param {?number} [params.id=null] - Field Guide identifier.
     * @param {string} [params.name=''] - Field Guide full name.
     */
    constructor({ id = null, name = '' } = {}) {
        this.id = id;
        this.name = name;
    }
}
