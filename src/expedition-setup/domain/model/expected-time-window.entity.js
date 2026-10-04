/**
 * Expected Time Window entity within the Expedition Setup bounded context.
 */
export class ExpectedTimeWindow {
    /**
     * @param {Object} params - Expected Time Window attributes.
     * @param {?number} [params.id=null] - Window identifier.
     * @param {?number} [params.routeId=null] - Associated route identifier.
     * @param {?number} [params.fromCheckpointId=null] - Segment origin checkpoint.
     * @param {?number} [params.toCheckpointId=null] - Segment destination checkpoint.
     * @param {?number} [params.minimumMinutes=null] - Minimum expected segment duration.
     * @param {?number} [params.maximumMinutes=null] - Maximum expected segment duration.
     */
    constructor({
                    id = null,
                    routeId = null,
                    fromCheckpointId = null,
                    toCheckpointId = null,
                    minimumMinutes = null,
                    maximumMinutes = null,
                } = {}) {
        this.id = id;
        this.routeId = routeId;
        this.fromCheckpointId = fromCheckpointId;
        this.toCheckpointId = toCheckpointId;
        this.minimumMinutes = minimumMinutes;
        this.maximumMinutes = maximumMinutes;
    }
}