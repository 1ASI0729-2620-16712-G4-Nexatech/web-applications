import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Route } from '../domain/model/route.entity.js';
import { Checkpoint } from '../domain/model/checkpoint.entity.js';
import {
    ExpectedTimeWindow,
} from '../domain/model/expected-time-window.entity.js';
import { ExpeditionGroup } from '../domain/model/expedition-group.entity.js';
import { FieldGuide } from '../domain/model/field-guide.entity.js';
import { ManifestEntry } from '../domain/model/manifest-entry.entity.js';
import { RouteAssembler } from '../infrastructure/route.assembler.js';
import { CheckpointAssembler } from '../infrastructure/checkpoint.assembler.js';
import {
    ExpectedTimeWindowAssembler,
} from '../infrastructure/expected-time-window.assembler.js';
import {
    ExpeditionGroupAssembler,
} from '../infrastructure/expedition-group.assembler.js';
import {
    FieldGuideAssembler,
} from '../infrastructure/field-guide.assembler.js';
import {
    ManifestEntryAssembler,
} from '../infrastructure/manifest-entry.assembler.js';
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
    const fieldGuides = ref([]);
    const manifestEntries = ref([]);
    const errors = ref([]);
    const routesLoaded = ref(false);
    const checkpointsLoaded = ref(false);
    const expectedTimeWindowsLoaded = ref(false);
    const expeditionGroupsLoaded = ref(false);
    const fieldGuidesLoaded = ref(false);
    const manifestEntriesLoaded = ref(false);

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

    function fetchFieldGuides() {
        return expeditionSetupApi.getFieldGuides()
            .then((response) => {
                fieldGuides.value = FieldGuideAssembler.toEntitiesFromResponse(response);
                fieldGuidesLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.fieldGuideAssignmentFailed'),
                );
            });
    }

    function fetchManifestEntries() {
        return expeditionSetupApi.getManifestEntries()
            .then((response) => {
                manifestEntries.value = ManifestEntryAssembler
                    .toEntitiesFromResponse(response);

                manifestEntriesLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.manifestEntryCreationFailed'),
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

    function isFieldGuideDateConflicted(fieldGuideId, departureDate, excludeGroupId) {
        return expeditionGroups.value.some((expeditionGroup) => (
            expeditionGroup.id !== excludeGroupId
            && expeditionGroup.fieldGuideId === fieldGuideId
            && expeditionGroup.departureDate === departureDate
        ));
    }

    function getManifestEntriesByGroupId(expeditionGroupId) {
        return manifestEntries.value.filter((manifestEntry) => (
            manifestEntry.expeditionGroupId === expeditionGroupId
        ));
    }

    function isIdentityDocumentDuplicated(expeditionGroupId, identityDocument) {
        const normalizedDocument = identityDocument.trim().toLocaleLowerCase();

        return getManifestEntriesByGroupId(expeditionGroupId).some(
            (manifestEntry) => (
                manifestEntry.identityDocument.trim().toLocaleLowerCase()
                === normalizedDocument
            ),
        );
    }

    function isIdentityDocumentRegisteredOnDate(
        identityDocument,
        departureDate,
        excludeGroupId,
    ) {
        const normalizedDocument = identityDocument.trim().toLocaleLowerCase();

        return manifestEntries.value.some((manifestEntry) => {
            if (manifestEntry.expeditionGroupId === excludeGroupId) {
                return false;
            }

            if (
                manifestEntry.identityDocument.trim().toLocaleLowerCase()
                !== normalizedDocument
            ) {
                return false;
            }

            const otherGroup = expeditionGroups.value.find(
                (currentGroup) => currentGroup.id === manifestEntry.expeditionGroupId,
            );

            return otherGroup?.departureDate === departureDate;
        });
    }

    function isGroupAtMaximumCapacity(expeditionGroupId) {
        const expeditionGroup = expeditionGroups.value.find(
            (currentGroup) => currentGroup.id === expeditionGroupId,
        );

        if (!expeditionGroup) {
            return false;
        }

        return getManifestEntriesByGroupId(expeditionGroupId).length
            >= expeditionGroup.maximumCapacity;
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
     * @param {number} expeditionGroupId
     * @param {number} fieldGuideId
     * @param {boolean} [confirmConflict=false]
     * @returns {Promise<ExpeditionGroup|{conflict: true}|null>}
     */
    function assignFieldGuide(expeditionGroupId, fieldGuideId, confirmConflict = false) {
        const groupIndex = expeditionGroups.value.findIndex(
            (expeditionGroup) => expeditionGroup.id === expeditionGroupId,
        );

        if (groupIndex === -1) {
            errors.value.push(
                createApplicationError('errors.fieldGuideAssignmentFailed'),
            );

            return Promise.resolve(null);
        }

        const currentGroup = expeditionGroups.value[groupIndex];

        if (
            !confirmConflict
            && isFieldGuideDateConflicted(
                fieldGuideId,
                currentGroup.departureDate,
                currentGroup.id,
            )
        ) {
            return Promise.resolve({ conflict: true });
        }

        const groupToUpdate = new ExpeditionGroup({
            ...currentGroup,
            fieldGuideId,
        });

        return expeditionSetupApi.updateExpeditionGroup(
            groupToUpdate.id,
            groupToUpdate,
        )
            .then((response) => {
                const updatedGroup = ExpeditionGroupAssembler
                    .toEntityFromResource(response.data);

                expeditionGroups.value[groupIndex] = updatedGroup;
                return updatedGroup;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.fieldGuideAssignmentFailed'),
                );

                return null;
            });
    }

    /**
     * @param {ManifestEntry} manifestEntry
     * @returns {Promise<ManifestEntry|null>}
     */
    function addManifestEntry(manifestEntry) {
        if (
            isIdentityDocumentDuplicated(
                manifestEntry.expeditionGroupId,
                manifestEntry.identityDocument,
            )
        ) {
            errors.value.push(
                createApplicationError('errors.manifestEntryDocumentDuplicated'),
            );

            return Promise.resolve(null);
        }

        const currentGroup = expeditionGroups.value.find(
            (group) => group.id === manifestEntry.expeditionGroupId,
        );

        if (
            currentGroup
            && isIdentityDocumentRegisteredOnDate(
                manifestEntry.identityDocument,
                currentGroup.departureDate,
                manifestEntry.expeditionGroupId,
            )
        ) {
            errors.value.push(
                createApplicationError('errors.manifestEntryDateConflict'),
            );

            return Promise.resolve(null);
        }

        if (isGroupAtMaximumCapacity(manifestEntry.expeditionGroupId)) {
            errors.value.push(
                createApplicationError('errors.manifestEntryCapacityExceeded'),
            );

            return Promise.resolve(null);
        }

        return expeditionSetupApi.createManifestEntry(manifestEntry)
            .then((response) => {
                const newManifestEntry = ManifestEntryAssembler
                    .toEntityFromResource(response.data);

                manifestEntries.value.push(newManifestEntry);
                return newManifestEntry;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.manifestEntryCreationFailed'),
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
        fieldGuides,
        manifestEntries,
        errors,
        routesLoaded,
        checkpointsLoaded,
        expectedTimeWindowsLoaded,
        expeditionGroupsLoaded,
        fieldGuidesLoaded,
        manifestEntriesLoaded,
        routesCount,
        fetchRoutes,
        fetchCheckpoints,
        fetchExpectedTimeWindows,
        fetchExpeditionGroups,
        fetchFieldGuides,
        fetchManifestEntries,
        getCheckpointsByRouteId,
        getExpectedTimeWindowsByRouteId,
        getExpeditionGroupsByRouteId,
        getManifestEntriesByGroupId,
        getRouteSegments,
        getPendingSegmentsByRouteId,
        routeHasCheckpoints,
        isGroupAtMaximumCapacity,
        addRoute,
        addCheckpoint,
        addExpectedTimeWindow,
        addExpeditionGroup,
        assignFieldGuide,
        addManifestEntry,
        enableRoute,
        clearErrors,
    };
});

export default useExpeditionSetupStore;