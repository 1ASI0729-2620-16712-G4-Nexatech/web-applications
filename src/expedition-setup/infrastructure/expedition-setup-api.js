import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const routesEndpointPath = import.meta.env.VITE_ROUTES_ENDPOINT_PATH;
const checkpointsEndpointPath = import.meta.env.VITE_CHECKPOINTS_ENDPOINT_PATH;
const expectedTimeWindowsEndpointPath = import.meta.env
    .VITE_EXPECTED_TIME_WINDOWS_ENDPOINT_PATH;
const expeditionGroupsEndpointPath = import.meta.env
    .VITE_EXPEDITION_GROUPS_ENDPOINT_PATH;
const fieldGuidesEndpointPath = import.meta.env.VITE_FIELD_GUIDES_ENDPOINT_PATH;

/**
 * API gateway for the Expedition Setup bounded context.
 */
export class ExpeditionSetupApi extends BaseApi {
    #routesEndpoint;
    #checkpointsEndpoint;
    #expectedTimeWindowsEndpoint;
    #expeditionGroupsEndpoint;
    #fieldGuidesEndpoint;

    constructor() {
        super();

        this.#routesEndpoint = new BaseEndpoint(this, routesEndpointPath);
        this.#checkpointsEndpoint = new BaseEndpoint(
            this,
            checkpointsEndpointPath,
        );
        this.#expectedTimeWindowsEndpoint = new BaseEndpoint(
            this,
            expectedTimeWindowsEndpointPath,
        );
        this.#expeditionGroupsEndpoint = new BaseEndpoint(
            this,
            expeditionGroupsEndpointPath,
        );
        this.#fieldGuidesEndpoint = new BaseEndpoint(
            this,
            fieldGuidesEndpointPath,
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

    getExpectedTimeWindows() {
        return this.#expectedTimeWindowsEndpoint.getAll();
    }

    createExpectedTimeWindow(expectedTimeWindow) {
        return this.#expectedTimeWindowsEndpoint.create(
            expectedTimeWindow,
        );
    }

    getExpeditionGroups() {
        return this.#expeditionGroupsEndpoint.getAll();
    }

    createExpeditionGroup(expeditionGroup) {
        return this.#expeditionGroupsEndpoint.create(expeditionGroup);
    }

    updateExpeditionGroup(expeditionGroupId, expeditionGroup) {
        return this.#expeditionGroupsEndpoint.update(
            expeditionGroupId,
            expeditionGroup,
        );
    }

    getFieldGuides() {
        return this.#fieldGuidesEndpoint.getAll();
    }
}