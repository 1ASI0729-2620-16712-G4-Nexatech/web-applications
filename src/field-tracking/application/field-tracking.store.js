import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { FieldTrackingApi } from '../infrastructure/field-tracking-api.js';
import {
    GroupProgressAssembler,
} from '../infrastructure/group-progress.assembler.js';

const fieldTrackingApi = new FieldTrackingApi();

const STALE_SYNCHRONIZATION_MINUTES = 30;

function createApplicationError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

const useFieldTrackingStore = defineStore('fieldTracking', () => {
    const groupProgressRecords = ref([]);
    const errors = ref([]);
    const groupProgressRecordsLoaded = ref(false);

    const groupProgressRecordsCount = computed(() => (
        groupProgressRecordsLoaded.value ? groupProgressRecords.value.length : 0
    ));

    function fetchGroupProgressRecords() {
        return fieldTrackingApi.getGroupProgressRecords()
            .then((response) => {
                groupProgressRecords.value = GroupProgressAssembler
                    .toEntitiesFromResponse(response);

                groupProgressRecordsLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.groupProgressFetchFailed'),
                );
            });
    }

    function getGroupProgressByGroupId(expeditionGroupId) {
        return groupProgressRecords.value.find((groupProgress) => (
            groupProgress.expeditionGroupId === expeditionGroupId
        ));
    }

    function isSynchronizationStale(synchronizedAt) {
        const elapsedMinutes = (Date.now() - new Date(synchronizedAt).getTime())
            / 60000;

        return elapsedMinutes > STALE_SYNCHRONIZATION_MINUTES;
    }

    function clearErrors() {
        errors.value = [];
    }

    return {
        groupProgressRecords,
        errors,
        groupProgressRecordsLoaded,
        groupProgressRecordsCount,
        fetchGroupProgressRecords,
        getGroupProgressByGroupId,
        isSynchronizationStale,
        clearErrors,
    };
});

export default useFieldTrackingStore;
