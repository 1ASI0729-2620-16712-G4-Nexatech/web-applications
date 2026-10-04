/**
 * Manifest Entry entity within the Expedition Setup bounded context.
 */
export class ManifestEntry {
    /**
     * @param {Object} params - Manifest Entry attributes.
     * @param {?number} [params.id=null] - Manifest Entry identifier.
     * @param {?number} [params.expeditionGroupId=null] - Associated expedition group identifier.
     * @param {string} [params.fullName=''] - Tourist full name.
     * @param {string} [params.identityDocument=''] - Tourist identity document number.
     */
    constructor({
                    id = null,
                    expeditionGroupId = null,
                    fullName = '',
                    identityDocument = '',
                } = {}) {
        this.id = id;
        this.expeditionGroupId = expeditionGroupId;
        this.fullName = fullName;
        this.identityDocument = identityDocument;
    }
}
