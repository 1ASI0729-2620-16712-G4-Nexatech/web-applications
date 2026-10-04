import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const groupProgressEndpointPath = import.meta.env.VITE_GROUP_PROGRESS_ENDPOINT_PATH;

/**
 * API gateway for the Field Tracking bounded context.
 */
export class FieldTrackingApi extends BaseApi {
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
