/**
 * Route entity within the Expedition Setup bounded context.
 */
export class Route {
    /**
     * @param {Object} params - Route attributes.
     * @param {?number} [params.id=null] - Route identifier.
     * @param {string} [params.name=''] - Unique route name.
     * @param {string} [params.origin=''] - Starting location.
     * @param {string} [params.destination=''] - Ending location.
     * @param {?number} [params.distanceKm=null] - Total route distance in kilometers.
     * @param {?number} [params.elevationGainMeters=null] - Total elevation gain in meters.
     * @param {string} [params.difficulty=''] - Route difficulty.
     * @param {?number} [params.estimatedDurationMinutes=null] - Estimated duration in minutes.
     * @param {string} [params.status='draft'] - Route configuration status.
     */
    constructor({
                    id = null,
                    name = '',
                    origin = '',
                    destination = '',
                    distanceKm = null,
                    elevationGainMeters = null,
                    difficulty = '',
                    estimatedDurationMinutes = null,
                    status = 'draft',
                } = {}) {
        this.id = id;
        this.name = name;
        this.origin = origin;
        this.destination = destination;
        this.distanceKm = distanceKm;
        this.elevationGainMeters = elevationGainMeters;
        this.difficulty = difficulty;
        this.estimatedDurationMinutes = estimatedDurationMinutes;
        this.status = status;
    }
}