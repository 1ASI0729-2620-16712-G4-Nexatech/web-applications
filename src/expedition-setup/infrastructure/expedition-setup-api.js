import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const routesEndpointPath = import.meta.env.VITE_ROUTES_ENDPOINT_PATH;
const checkpointsEndpointPath = import.meta.env.VITE_CHECKPOINTS_ENDPOINT_PATH;
/**
 * API gateway for the Expedition Setup bounded context.
 */

export class ExpeditionSetupApi extends BaseApi {
    #routesEndpoint;
    #checkpointsEndpoint;

    constructor() {
        super();
        this.#routesEndpoint = new BaseEndpoint(this, routesEndpointPath);
        this.#checkpointsEndpoint = new BaseEndpoint(
            this,
            checkpointsEndpointPath,
        );
    }

    getRoutes() {
        return this.#routesEndpoint.getAll();
    }

    createRoute(route) {
        return this.#routesEndpoint.create(route);
    }

    updateRoute(routeId, route) {
        return this.#routesEndpoint.update(routeId, route);
    }

    getCheckpoints() {
        return this.#checkpointsEndpoint.getAll();
    }

    createCheckpoint(checkpoint) {
        return this.#checkpointsEndpoint.create(checkpoint);
    }
}