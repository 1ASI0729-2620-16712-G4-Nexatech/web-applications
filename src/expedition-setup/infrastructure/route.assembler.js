import { Route } from '../domain/model/route.entity.js';

/**
 * Maps Route resources into Route domain entities.
 */
export class RouteAssembler {
    /**
     * @param {Object} resource - Route resource payload.
     * @returns {Route} Route entity.
     */
    static toEntityFromResource(resource) {
        return new Route({ ...resource });
    }

    /**
     * @param {import('axios').AxiosResponse<Array<Object>|Object>} response
     * @returns {Route[]} Route entities.
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }

        const resources = Array.isArray(response.data)
            ? response.data
            : response.data.routes;

        return resources.map((resource) => this.toEntityFromResource(resource));
    }
}