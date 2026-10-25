import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { EarlyWarningAlert } from '../domain/model/early-warning-alert.entity.js';
import {
    EarlyWarningAlertAssembler,
} from '../infrastructure/early-warning-alert.assembler.js';
import { SafetyMonitoringApi } from '../infrastructure/safety-monitoring-api.js';
import { evaluateSafety } from '../domain/model/safety-evaluation.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';
import { requireCondition } from '../../shared/domain/application-error.js';

const safetyMonitoringApi = new SafetyMonitoringApi();

const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function createApplicationError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

const useSafetyMonitoringStore = defineStore('safetyMonitoring', () => {
    const earlyWarningAlerts = ref([]);
    const errors = ref([]);
    const earlyWarningAlertsLoaded = ref(false);

    const activeEarlyWarningAlertsCount = computed(() => (
        earlyWarningAlertsLoaded.value
            ? earlyWarningAlerts.value.filter(
                (alert) => alert.status === 'active',
            ).length
            : 0
    ));

    function fetchEarlyWarningAlerts() {
        return safetyMonitoringApi.getEarlyWarningAlerts()
            .then((response) => {
                earlyWarningAlerts.value = EarlyWarningAlertAssembler
                    .toEntitiesFromResponse(response);

                earlyWarningAlertsLoaded.value = true;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.earlyWarningAlertsFetchFailed'),
                );
            }).finally(() => { earlyWarningAlertsLoaded.value = true; });
    }

    function getEarlyWarningAlertsByGroupId(expeditionGroupId) {
        return earlyWarningAlerts.value
            .filter((alert) => alert.expeditionGroupId === expeditionGroupId)
            .sort((first, second) => (
                PRIORITY_RANK[second.priority] - PRIORITY_RANK[first.priority]
            ));
    }

    function isAlertActionable(status) {
        return status === 'active' || status === 'acknowledged';
    }

    function updateAlertStatus(earlyWarningAlertId, status) {
        const alertIndex = earlyWarningAlerts.value.findIndex(
            (alert) => alert.id === earlyWarningAlertId,
        );

        if (alertIndex === -1) {
            errors.value.push(
                createApplicationError('errors.earlyWarningAlertActionFailed'),
            );

            return Promise.resolve(null);
        }

        const currentAlert = earlyWarningAlerts.value[alertIndex];

        if (!isAlertActionable(currentAlert.status)) {
            errors.value.push(
                createApplicationError('errors.earlyWarningAlertNotActionable'),
            );

            return Promise.resolve(null);
        }

        const alertToUpdate = new EarlyWarningAlert({
            ...currentAlert,
            status,
            resolvedAt: status === 'acknowledged'
                ? currentAlert.resolvedAt
                : new Date().toISOString(),
        });

        return safetyMonitoringApi.updateEarlyWarningAlert(
            alertToUpdate.id,
            alertToUpdate,
        )
            .then(async (response) => {
                const updatedAlert = EarlyWarningAlertAssembler
                    .toEntityFromResource(response.data);

                earlyWarningAlerts.value[alertIndex] = updatedAlert;
                await updateProgressRisk(updatedAlert.expeditionGroupId);
                return updatedAlert;
            })
            .catch(() => {
                errors.value.push(
                    createApplicationError('errors.earlyWarningAlertActionFailed'),
                );

                return null;
            });
    }

    /**
     * @param {number} earlyWarningAlertId
     * @returns {Promise<EarlyWarningAlert|null>}
     */
    function acknowledgeAlert(earlyWarningAlertId) {
        return updateAlertStatus(earlyWarningAlertId, 'acknowledged');
    }

    /**
     * @param {number} earlyWarningAlertId
     * @returns {Promise<EarlyWarningAlert|null>}
     */
    function resolveAlert(earlyWarningAlertId) {
        return updateAlertStatus(earlyWarningAlertId, 'resolved');
    }

    /**
     * @param {number} earlyWarningAlertId
     * @returns {Promise<EarlyWarningAlert|null>}
     */
    function dismissAlertAsFalseAlarm(earlyWarningAlertId) {
        return updateAlertStatus(earlyWarningAlertId, 'dismissed');
    }

    function clearErrors() {
        errors.value = [];
    }

    async function evaluate(group, telemetry, arrivals, segments, preparations) {
        const iam = useIamStore();
        requireCondition(iam.user?.role !== Roles.TOURIST && canAccessGroup(iam.user, group), 'workflow.errors.forbidden');
        requireCondition(group.status === 'active', 'workflow.errors.notActive');
        await fetchEarlyWarningAlerts();
        for (const result of evaluateSafety(group, telemetry, arrivals, segments, preparations)) {
            if (earlyWarningAlerts.value.some((alert) => alert.expeditionGroupId === group.id && alert.evaluationKey === result.key && isAlertActionable(alert.status))) continue;
            const response = await safetyMonitoringApi.createEarlyWarningAlert(new EarlyWarningAlert({ ...result, evaluationKey: result.key, expeditionGroupId: group.id, triggeredAt: new Date().toISOString(), status: 'active' }));
            earlyWarningAlerts.value.push(EarlyWarningAlertAssembler.toEntityFromResource(response.data));
        }
        await updateProgressRisk(group.id);
    }

    async function updateProgressRisk(groupId) {
        const actionable = getEarlyWarningAlertsByGroupId(groupId).filter((a) => isAlertActionable(a.status));
        const highest = actionable[0]?.priority ?? 'low';
        await safetyMonitoringApi.updateProgressRisk(groupId, highest === 'critical' ? 'high' : highest, actionable.some((a) => a.type === 'delay') ? 'delayed' : 'on-track');
    }

    return {
        earlyWarningAlerts,
        errors,
        earlyWarningAlertsLoaded,
        activeEarlyWarningAlertsCount,
        fetchEarlyWarningAlerts,
        getEarlyWarningAlertsByGroupId,
        isAlertActionable,
        acknowledgeAlert,
        resolveAlert,
        dismissAlertAsFalseAlarm,
        clearErrors,
        evaluate,
    };
});

export default useSafetyMonitoringStore;
