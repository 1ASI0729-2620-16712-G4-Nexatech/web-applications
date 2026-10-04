/**
 * Checkpoint entity within the Expedition Setup bounded context.
 */
export class Checkpoint {
    /**
     * @param {Object} params - Checkpoint attributes.
     * @param {?number} [params.id=null] - Checkpoint identifier.
     * @param {?number} [params.routeId=null] - Associated route identifier.
     * @param {string} [params.location=''] - Checkpoint location.
     * @param {?number} [params.sequenceOrder=null] - Position within the route.
     */
    constructor({
                    id = null,
                    routeId = null,
                    location = '',
                    sequenceOrder = null,
                } = {}) {
        this.id = id;
        this.routeId = routeId;
        this.location = location;
        this.sequenceOrder = sequenceOrder;
    }
}