/**
 * Field Guide entity within the Expedition Setup bounded context. The operational code, unique in the agency, tells
 * apart guides with the same name without exposing personal data.
 */
export class FieldGuide {
    /**
     * @param {Object} params - Field Guide attributes.
     * @param {?number} [params.id=null] - Field Guide identifier.
     * @param {string} [params.name=''] - Field Guide full name.
     * @param {string} [params.code=''] - Operational code, such as GU-003.
     */
    constructor({ id = null, name = '', code = '', ...metadata
                } = {}) {
        Object.assign(this, metadata);
        this.id = id;
        this.name = name;
        this.code = code ?? '';
    }

    /** Name followed by the operational code, used wherever a guide is chosen. */
    get label() {
        return this.code ? `${this.name} · ${this.code}` : this.name;
    }
}
