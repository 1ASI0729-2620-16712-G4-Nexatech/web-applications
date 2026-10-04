import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const routesEndpointPath = import.meta.env.VITE_ROUTES_ENDPOINT_PATH;

/**
 * API gateway for the Expedition Setup bounded context.
 */
export class ExpeditionSetupApi extends BaseApi {
    #routesEndpoint;

    constructor() {
        super();
        this.#routesEndpoint = new BaseEndpoint(this, routesEndpointPath);
    }

    /**
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getRoutes() {
        return this.#routesEndpoint.getAll();
    }

    /**
     * @param {Object} route - Route resource to create.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createRoute(route) {
        return this.#routesEndpoint.create(route);
    }
}