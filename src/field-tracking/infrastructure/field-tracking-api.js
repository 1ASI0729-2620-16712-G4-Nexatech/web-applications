import { SimulatedApi } from '../../shared/infrastructure/simulated-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const groupProgressEndpointPath = import.meta.env.VITE_GROUP_PROGRESS_ENDPOINT_PATH || '/group-progress';

/**
 * API gateway for the Field Tracking bounded context.
 */
export class FieldTrackingApi extends SimulatedApi {
    #groupProgressEndpoint;

    constructor() {
        super();

        this.#groupProgressEndpoint = new BaseEndpoint(
            this,
            groupProgressEndpointPath,
        );
    }

    getGroupProgressRecords() {
        return this.#groupProgressEndpoint.getAll();
    }
}
