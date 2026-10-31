import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const routesEndpointPath = import.meta.env.VITE_ROUTES_ENDPOINT_PATH || '/routes';
const checkpointsEndpointPath = import.meta.env.VITE_CHECKPOINTS_ENDPOINT_PATH || '/checkpoints';
const expectedTimeWindowsEndpointPath = import.meta.env
    .VITE_EXPECTED_TIME_WINDOWS_ENDPOINT_PATH || '/expected-time-windows';
const expeditionGroupsEndpointPath = import.meta.env
    .VITE_EXPEDITION_GROUPS_ENDPOINT_PATH || '/expedition-groups';
const fieldGuidesEndpointPath = import.meta.env.VITE_FIELD_GUIDES_ENDPOINT_PATH || '/field-guides';
const manifestEntriesEndpointPath = import.meta.env
    .VITE_MANIFEST_ENTRIES_ENDPOINT_PATH || '/manifest-entries';

/**
 * API gateway for the Expedition Setup bounded context.
 */
export class ExpeditionSetupApi extends BaseApi {
    #routesEndpoint;
    #checkpointsEndpoint;
    #expectedTimeWindowsEndpoint;
    #expeditionGroupsEndpoint;
    #fieldGuidesEndpoint;
    #manifestEntriesEndpoint;

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
        this.#manifestEntriesEndpoint = new BaseEndpoint(
            this,
            manifestEntriesEndpointPath,
        );
    }

    getRoutes() {
        return this.#routesEndpoint.getAll();
    }

    createRoute(route) {
        return this.#routesEndpoint.create(route);
    }

    updateRouteStatus(routeId, status) {
        return this.http.patch(`${routesEndpointPath}/${routeId}/status`, { status });
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

    assignFieldGuide(expeditionGroupId, fieldGuideId, confirmScheduleConflict = false) {
        return this.http.put(
            `${expeditionGroupsEndpointPath}/${expeditionGroupId}/field-guide`,
            { fieldGuideId, confirmScheduleConflict },
        );
    }

    getFieldGuides() {
        return this.#fieldGuidesEndpoint.getAll();
    }

    getManifestEntries() {
        return this.#manifestEntriesEndpoint.getAll();
    }

    createManifestEntry(manifestEntry) {
        return this.#manifestEntriesEndpoint.create(manifestEntry);
    }
}