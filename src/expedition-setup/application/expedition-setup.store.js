import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Route } from '../domain/model/route.entity.js';
import { RouteAssembler } from '../infrastructure/route.assembler.js';
import { ExpeditionSetupApi } from '../infrastructure/expedition-setup-api.js';

const expeditionSetupApi = new ExpeditionSetupApi();

function createApplicationError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

const useExpeditionSetupStore = defineStore('expeditionSetup', () => {
    const routes = ref([]);
    const errors = ref([]);
    const routesLoaded = ref(false);

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

    function isRouteNameDuplicated(name) {
        const normalizedName = name.trim().toLocaleLowerCase();

        return routes.value.some((route) => (
            route.name.trim().toLocaleLowerCase() === normalizedName
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

    function clearErrors() {
        errors.value = [];
    }

    return {
        routes,
        errors,
        routesLoaded,
        routesCount,
        fetchRoutes,
        addRoute,
        clearErrors,
    };
});

export default useExpeditionSetupStore;