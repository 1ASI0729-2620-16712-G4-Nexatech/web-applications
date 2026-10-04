import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Route } from '../domain/model/route.entity.js';
import { Checkpoint } from '../domain/model/checkpoint.entity.js';
import { RouteAssembler } from '../infrastructure/route.assembler.js';
import { CheckpointAssembler } from '../infrastructure/checkpoint.assembler.js';
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
    const errors = ref([]);
    const routesLoaded = ref(false);
    const checkpointsLoaded = ref(false);

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
        errors,
        routesLoaded,
        checkpointsLoaded,
        routesCount,
        fetchRoutes,
        fetchCheckpoints,
        getCheckpointsByRouteId,
        routeHasCheckpoints,
        addRoute,
        addCheckpoint,
        clearErrors,
        enableRoute,
    };
});

export default useExpeditionSetupStore;