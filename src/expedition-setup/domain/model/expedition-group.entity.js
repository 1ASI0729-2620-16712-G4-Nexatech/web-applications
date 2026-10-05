/**
 * Expedition Group entity within the Expedition Setup bounded context.
 */
export class ExpeditionGroup {
    /**
     * @param {Object} params - Expedition Group attributes.
     * @param {?number} [params.id=null] - Expedition Group identifier.
     * @param {?number} [params.routeId=null] - Associated route identifier.
     * @param {string} [params.name=''] - Expedition group name.
     * @param {string} [params.departureDate=''] - Scheduled departure date (ISO date string).
     * @param {?number} [params.maximumCapacity=null] - Maximum number of tourists allowed in the group.
     * @param {?number} [params.fieldGuideId=null] - Assigned field guide identifier.
     */
    constructor({
                    id = null,
                    routeId = null,
                    name = '',
                    departureDate = '',
                    maximumCapacity = null,
                    fieldGuideId = null,
                } = {}) {
        this.id = id;
        this.routeId = routeId;
        this.name = name;
        this.departureDate = departureDate;
        this.maximumCapacity = maximumCapacity;
        this.fieldGuideId = fieldGuideId;
    }
}
