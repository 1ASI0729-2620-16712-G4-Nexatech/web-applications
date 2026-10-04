import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Route } from '../domain/model/route.entity.js';
import { Checkpoint } from '../domain/model/checkpoint.entity.js';
import {
    ExpectedTimeWindow,
} from '../domain/model/expected-time-window.entity.js';
import { ExpeditionGroup } from '../domain/model/expedition-group.entity.js';
import { RouteAssembler } from '../infrastructure/route.assembler.js';
import { CheckpointAssembler } from '../infrastructure/checkpoint.assembler.js';
import {
    ExpectedTimeWindowAssembler,
} from '../infrastructure/expected-time-window.assembler.js';
import {
    ExpeditionGroupAssembler,
} from '../infrastructure/expedition-group.assembler.js';
import { ExpeditionSetupApi } from '../infrastructure/expedition-setup-api.js';

const expeditionSetupApi = new ExpeditionSetupApi();

function createApplicationError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

const useExpeditionSetupStore = defineStore('expeditionSetup', () => {
    const routes = ref([]);
    const checkpoints = ref([]);
    const expectedTimeWindows = ref([]);
    const expeditionGroups = ref([]);
    const errors = ref([]);
    const routesLoaded = ref(false);
    const checkpointsLoaded = ref(false);
    const expectedTimeWindowsLoaded = ref(false);
    const expeditionGroupsLoaded = ref(false);

    const routesCount = computed(() => (
        routesLoaded.value ? routes.value.length : 0
    ));

    function fetchRoutes() {
        return expeditionSetupApi.getRoutes()
            .then((response) => {
                routes.value = RouteAssembler.toEntitiesFromResponse(response);
                routesLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.routeCreationFailed'),
                );
            });
    }

    function fetchCheckpoints() {
        return expeditionSetupApi.getCheckpoints()
            .then((response) => {
                checkpoints.value = CheckpointAssembler.toEntitiesFromResponse(response);
                checkpointsLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.checkpointCreationFailed'),
                );
            });
    }

    function fetchExpectedTimeWindows() {
        return expeditionSetupApi.getExpectedTimeWindows()
            .then((response) => {
                expectedTimeWindows.value = ExpectedTimeWindowAssembler
                    .toEntitiesFromResponse(response);

                expectedTimeWindowsLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.expectedTimeWindowCreationFailed'),
                );
            });
    }

    function fetchExpeditionGroups() {
        return expeditionSetupApi.getExpeditionGroups()
            .then((response) => {
                expeditionGroups.value = ExpeditionGroupAssembler
                    .toEntitiesFromResponse(response);

                expeditionGroupsLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.expeditionGroupCreationFailed'),
                );
            });
    }

    function isRouteNameDuplicated(name) {
        const normalizedName = name.trim().toLocaleLowerCase();

        return routes.value.some((route) => (
            route.name.trim().toLocaleLowerCase() === normalizedName
        ));
    }

    function getCheckpointsByRouteId(routeId) {
        return checkpoints.value
            .filter((checkpoint) => checkpoint.routeId === routeId)
            .sort((first, second) => (
                first.sequenceOrder - second.sequenceOrder
            ));
    }

    function routeHasCheckpoints(routeId) {
        return getCheckpointsByRouteId(routeId).length > 0;
    }

    function isCheckpointOrderDuplicated(routeId, sequenceOrder) {
        return checkpoints.value.some((checkpoint) => (
            checkpoint.routeId === routeId
            && checkpoint.sequenceOrder === sequenceOrder
        ));
    }

    function getExpectedTimeWindowsByRouteId(routeId) {
        return expectedTimeWindows.value.filter((expectedTimeWindow) => (
            expectedTimeWindow.routeId === routeId
        ));
    }

    function isExpectedTimeWindowConfigured(
        routeId,
        fromCheckpointId,
        toCheckpointId,
    ) {
        return expectedTimeWindows.value.some((expectedTimeWindow) => (
            expectedTimeWindow.routeId === routeId
            && expectedTimeWindow.fromCheckpointId === fromCheckpointId
            && expectedTimeWindow.toCheckpointId === toCheckpointId
        ));
    }

    function getRouteSegments(routeId) {
        const orderedCheckpoints = getCheckpointsByRouteId(routeId);

        return orderedCheckpoints.slice(0, -1).map((fromCheckpoint, index) => {
            const toCheckpoint = orderedCheckpoints[index + 1];
            const expectedTimeWindow = getExpectedTimeWindowsByRouteId(routeId)
                .find((currentWindow) => (
                    currentWindow.fromCheckpointId === fromCheckpoint.id
                    && currentWindow.toCheckpointId === toCheckpoint.id
                ));

            return {
                routeId,
                fromCheckpoint,
                toCheckpoint,
                expectedTimeWindow,
            };
        });
    }

    function getPendingSegmentsByRouteId(routeId) {
        return getRouteSegments(routeId).filter((segment) => (
            !segment.expectedTimeWindow
        ));
    }

    function hasValidTimeWindowLimits(minimumMinutes, maximumMinutes) {
        return maximumMinutes > minimumMinutes;
    }

    function getExpeditionGroupsByRouteId(routeId) {
        return expeditionGroups.value.filter((expeditionGroup) => (
            expeditionGroup.routeId === routeId
        ));
    }

    function isRouteEnabledById(routeId) {
        const route = routes.value.find(
            (currentRoute) => currentRoute.id === routeId,
        );

        return route?.status === 'enabled';
    }

    function isDepartureDateInPast(departureDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return new Date(departureDate) < today;
    }

    /**
     * @param {Route} route
     * @returns {Promise<Route|null>}
     */
    function addRoute(route) {
        if (isRouteNameDuplicated(route.name)) {
            errors.value.push(
                createApplicationError('errors.routeNameDuplicated'),
            );

            return Promise.resolve(null);
        }

        return expeditionSetupApi.createRoute(route)
            .then((response) => {
                const newRoute = RouteAssembler.toEntityFromResource(response.data);
                routes.value.push(newRoute);
                return newRoute;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.routeCreationFailed'),
                );

                return null;
            });
    }

    /**
     * @param {Checkpoint} checkpoint
     * @returns {Promise<Checkpoint|null>}
     */
    function addCheckpoint(checkpoint) {
        if (
            isCheckpointOrderDuplicated(
                checkpoint.routeId,
                checkpoint.sequenceOrder,
            )
        ) {
            errors.value.push(
                createApplicationError('errors.checkpointSequenceDuplicated'),
            );

            return Promise.resolve(null);
        }

        return expeditionSetupApi.createCheckpoint(checkpoint)
            .then((response) => {
                const newCheckpoint = CheckpointAssembler.toEntityFromResource(
                    response.data,
                );

                checkpoints.value.push(newCheckpoint);
                return newCheckpoint;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.checkpointCreationFailed'),
                );

                return null;
            });
    }

    /**
     * @param {ExpectedTimeWindow} expectedTimeWindow
     * @returns {Promise<ExpectedTimeWindow|null>}
     */
    function addExpectedTimeWindow(expectedTimeWindow) {
        if (
            !hasValidTimeWindowLimits(
                expectedTimeWindow.minimumMinutes,
                expectedTimeWindow.maximumMinutes,
            )
        ) {
            errors.value.push(
                createApplicationError('errors.expectedTimeWindowLimitsInvalid'),
            );

            return Promise.resolve(null);
        }

        if (
            isExpectedTimeWindowConfigured(
                expectedTimeWindow.routeId,
                expectedTimeWindow.fromCheckpointId,
                expectedTimeWindow.toCheckpointId,
            )
        ) {
            errors.value.push(
                createApplicationError('errors.expectedTimeWindowAlreadyConfigured'),
            );

            return Promise.resolve(null);
        }

        return expeditionSetupApi.createExpectedTimeWindow(expectedTimeWindow)
            .then((response) => {
                const newExpectedTimeWindow = ExpectedTimeWindowAssembler
                    .toEntityFromResource(response.data);

                expectedTimeWindows.value.push(newExpectedTimeWindow);
                return newExpectedTimeWindow;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.expectedTimeWindowCreationFailed'),
                );

                return null;
            });
    }

    /**
     * @param {ExpeditionGroup} expeditionGroup
     * @returns {Promise<ExpeditionGroup|null>}
     */
    function addExpeditionGroup(expeditionGroup) {
        if (!isRouteEnabledById(expeditionGroup.routeId)) {
            errors.value.push(
                createApplicationError('errors.routeNotEnabledForGroups'),
            );

            return Promise.resolve(null);
        }

        if (isDepartureDateInPast(expeditionGroup.departureDate)) {
            errors.value.push(
                createApplicationError('errors.expeditionGroupDepartureDateInPast'),
            );

            return Promise.resolve(null);
        }

        return expeditionSetupApi.createExpeditionGroup(expeditionGroup)
            .then((response) => {
                const newExpeditionGroup = ExpeditionGroupAssembler
                    .toEntityFromResource(response.data);

                expeditionGroups.value.push(newExpeditionGroup);
                return newExpeditionGroup;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.expeditionGroupCreationFailed'),
                );

                return null;
            });
    }

    /**
     * @param {number} routeId
     * @returns {Promise<Route|null>}
     */
    function enableRoute(routeId) {
        if (!routeHasCheckpoints(routeId)) {
            errors.value.push(
                createApplicationError('errors.routeRequiresCheckpoint'),
            );

            return Promise.resolve(null);
        }

        const routeIndex = routes.value.findIndex(
            (currentRoute) => currentRoute.id === routeId,
        );

        if (routeIndex === -1) {
            errors.value.push(
                createApplicationError('errors.routeEnableFailed'),
            );

            return Promise.resolve(null);
        }

        const routeToEnable = new Route({
            ...routes.value[routeIndex],
            status: 'enabled',
        });

        return expeditionSetupApi.updateRoute(routeId, routeToEnable)
            .then((response) => {
                const enabledRoute = RouteAssembler.toEntityFromResource(response.data);
                routes.value[routeIndex] = enabledRoute;
                return enabledRoute;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.routeEnableFailed'),
                );

                return null;
            });
    }

    function clearErrors() {
        errors.value = [];
    }

    return {
        routes,
        checkpoints,
        expectedTimeWindows,
        expeditionGroups,
        errors,
        routesLoaded,
        checkpointsLoaded,
        expectedTimeWindowsLoaded,
        expeditionGroupsLoaded,
        routesCount,
        fetchRoutes,
        fetchCheckpoints,
        fetchExpectedTimeWindows,
        fetchExpeditionGroups,
        getCheckpointsByRouteId,
        getExpectedTimeWindowsByRouteId,
        getExpeditionGroupsByRouteId,
        getRouteSegments,
        getPendingSegmentsByRouteId,
        routeHasCheckpoints,
        addRoute,
        addCheckpoint,
        addExpectedTimeWindow,
        addExpeditionGroup,
        enableRoute,
        clearErrors,
    };
});

export default useExpeditionSetupStore;