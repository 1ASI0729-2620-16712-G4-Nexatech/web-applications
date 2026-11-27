import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { OPEN_ALERT_STATUSES, PRIORITY_RANK } from '../domain/model/early-warning-alert.entity.js';
import { EarlyWarningAlertAssembler } from '../infrastructure/early-warning-alert.assembler.js';
import { SafetyMonitoringApi } from '../infrastructure/safety-monitoring-api.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles } from '../../iam/domain/user.entity.js';
import { ApplicationError, toErrorCode } from '../../shared/domain/application-error.js';

const safetyMonitoringApi = new SafetyMonitoringApi();

/** Roles that may act on an alert; the server enforces the same rule and scopes it to the actor's groups. */
const ALERT_MANAGER_ROLES = Object.freeze([Roles.ADMIN, Roles.GUIDE]);

/** Message keys for the answers of the status endpoint; the server messages are localized text, not codes. */
const ACTION_ERROR_CODES_BY_STATUS = Object.freeze({
    403: 'workflow.errors.forbidden',
    404: 'workflow.errors.notFound',
    409: 'errors.earlyWarningAlertNotActionable',
});

/** Message keys for the evaluation endpoint: a 409 means the session is no longer active or is being evaluated. */
const EVALUATION_ERROR_CODES_BY_STATUS = Object.freeze({
    403: 'workflow.errors.forbidden',
    404: 'workflow.errors.notFound',
    409: 'errors.safetyEvaluationUnavailable',
});

function byUrgency(first, second) {
    return Number(second.isOpen) - Number(first.isOpen)
        || (PRIORITY_RANK[second.priority] ?? 0) - (PRIORITY_RANK[first.priority] ?? 0)
        || String(second.triggeredAt).localeCompare(String(first.triggeredAt));
}

/**
 * Application service of the Safety Monitoring bounded context. The server evaluates the persisted readings and
 * passages and raises the alerts; this store reads them, keeps the closed history of the sessions it consulted and
 * requests the status transitions an administrator or a field guide performs.
 */
const useSafetyMonitoringStore = defineStore('safetyMonitoring', () => {
    const iam = useIamStore();
    const earlyWarningAlerts = ref([]);
    const errors = ref([]);
    const earlyWarningAlertsLoaded = ref(false);

    const activeEarlyWarningAlertsCount = computed(() => (
        earlyWarningAlertsLoaded.value
            ? earlyWarningAlerts.value.filter((alert) => alert.status === 'active').length
            : 0
    ));

    /** Whether the signed-in user may acknowledge, dismiss or resolve alerts. */
    const canManageAlerts = computed(() => ALERT_MANAGER_ROLES.includes(iam.user?.role));

    function fail(code) {
        errors.value.push(new ApplicationError(code));
        return null;
    }

    function upsert(alerts) {
        const updatedIds = new Set(alerts.map((alert) => alert.id));
        earlyWarningAlerts.value = [
            ...earlyWarningAlerts.value.filter((alert) => !updatedIds.has(alert.id)),
            ...alerts,
        ];
    }

    /** Reads the open alerts of the visible groups; closed alerts already read for a session stay as history. */
    async function fetchEarlyWarningAlerts() {
        try {
            const openAlerts = EarlyWarningAlertAssembler
                .toEntitiesFromResponse(await safetyMonitoringApi.getOpenAlerts());
            const openIds = new Set(openAlerts.map((alert) => alert.id));
            earlyWarningAlerts.value = [
                ...earlyWarningAlerts.value.filter((alert) => !alert.isOpen && !openIds.has(alert.id)),
                ...openAlerts,
            ];
            return openAlerts;
        } catch {
            fail('errors.earlyWarningAlertsFetchFailed');
            return [];
        } finally {
            earlyWarningAlertsLoaded.value = true;
        }
    }

    /** Reads every alert of a tracking session, closed ones included, replacing what was known of it. */
    async function fetchAlertsForSession(sessionId) {
        try {
            const sessionAlerts = EarlyWarningAlertAssembler
                .toEntitiesFromResponse(await safetyMonitoringApi.getAlertsBySession(sessionId));
            const sessionIds = new Set(sessionAlerts.map((alert) => alert.id));
            earlyWarningAlerts.value = [
                ...earlyWarningAlerts.value.filter((alert) => alert.sessionId !== sessionId && !sessionIds.has(alert.id)),
                ...sessionAlerts,
            ];
            return sessionAlerts;
        } catch {
            fail('errors.earlyWarningAlertsFetchFailed');
            return [];
        } finally {
            earlyWarningAlertsLoaded.value = true;
        }
    }

    /** Alerts of a group: open ones first, then by priority and from the most recent. */
    function getEarlyWarningAlertsByGroupId(expeditionGroupId) {
        return earlyWarningAlerts.value
            .filter((alert) => alert.expeditionGroupId === expeditionGroupId)
            .sort(byUrgency);
    }

    /** @param {string|EarlyWarningAlert} alertOrStatus - An alert or its status. */
    function isAlertActionable(alertOrStatus) {
        const status = typeof alertOrStatus === 'string' ? alertOrStatus : alertOrStatus?.status;
        return OPEN_ALERT_STATUSES.includes(status);
    }

    async function changeAlertStatus(earlyWarningAlertId, status) {
        const currentAlert = earlyWarningAlerts.value.find((alert) => alert.id === earlyWarningAlertId);
        if (!currentAlert) return fail('errors.earlyWarningAlertActionFailed');
        if (!canManageAlerts.value) return fail('workflow.errors.forbidden');
        if (!currentAlert.isOpen) return fail('errors.earlyWarningAlertNotActionable');
        if (!currentAlert.canChangeTo(status)) return fail('workflow.errors.transition');
        try {
            const response = await safetyMonitoringApi.updateAlertStatus(earlyWarningAlertId, status);
            const updatedAlert = EarlyWarningAlertAssembler.toEntityFromResource(response.data);
            if (!updatedAlert) return fail('errors.earlyWarningAlertActionFailed');
            upsert([updatedAlert]);
            return updatedAlert;
        } catch (error) {
            const code = ACTION_ERROR_CODES_BY_STATUS[error?.response?.status];
            // A 409 means another user already closed or changed the alert: read it again to show its real status.
            if (error?.response?.status === 409 && currentAlert.sessionId) await fetchAlertsForSession(currentAlert.sessionId);
            return fail(code ?? 'errors.earlyWarningAlertActionFailed');
        }
    }

    /** @returns {Promise<EarlyWarningAlert|null>} The acknowledged alert, or null when the change was refused. */
    function acknowledgeAlert(earlyWarningAlertId) {
        return changeAlertStatus(earlyWarningAlertId, 'acknowledged');
    }

    /** @returns {Promise<EarlyWarningAlert|null>} The resolved alert, or null when the change was refused. */
    function resolveAlert(earlyWarningAlertId) {
        return changeAlertStatus(earlyWarningAlertId, 'resolved');
    }

    /** @returns {Promise<EarlyWarningAlert|null>} The dismissed alert, or null when the change was refused. */
    function dismissAlertAsFalseAlarm(earlyWarningAlertId) {
        return changeAlertStatus(earlyWarningAlertId, 'dismissed');
    }

    /**
     * Asks the server to evaluate the delay of a session now instead of waiting for the periodic evaluation.
     * @returns {Promise<EarlyWarningAlert[]>} The alerts raised by this evaluation.
     */
    async function requestEvaluation(sessionId) {
        if (!canManageAlerts.value) {
            fail('workflow.errors.forbidden');
            return [];
        }
        try {
            const raised = EarlyWarningAlertAssembler
                .toEntitiesFromResponse(await safetyMonitoringApi.requestEvaluation(sessionId));
            upsert(raised);
            return raised;
        } catch (error) {
            fail(EVALUATION_ERROR_CODES_BY_STATUS[error?.response?.status] ?? toErrorCode(error));
            return [];
        }
    }

    function clearErrors() {
        errors.value = [];
    }

    return {
        earlyWarningAlerts,
        errors,
        earlyWarningAlertsLoaded,
        activeEarlyWarningAlertsCount,
        canManageAlerts,
        fetchEarlyWarningAlerts,
        fetchAlertsForSession,
        getEarlyWarningAlertsByGroupId,
        isAlertActionable,
        acknowledgeAlert,
        resolveAlert,
        dismissAlertAsFalseAlarm,
        requestEvaluation,
        clearErrors,
    };
});

export default useSafetyMonitoringStore;
