import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import useSafetyMonitoringStore from '../application/safety-monitoring.store.js';
import useIamStore from '../../iam/application/iam.store.js';

const TRANSITIONS = Object.freeze({
    acknowledged: 'acknowledgeAlert',
    resolved: 'resolveAlert',
    dismissed: 'dismissAlertAsFalseAlarm',
});

/**
 * Requests alert transitions from a view and keeps, per alert, whether a request is running and the message of its
 * last refusal. It also names the users recorded in the audit of each alert.
 */
export function useAlertActions() {
    const { t } = useI18n();
    const safetyMonitoringStore = useSafetyMonitoringStore();
    const iamStore = useIamStore();
    const errorKeys = reactive({});
    const pending = reactive({});

    async function changeStatus(alert, status) {
        errorKeys[alert.id] = '';
        pending[alert.id] = true;
        safetyMonitoringStore.clearErrors();
        try {
            const updatedAlert = await safetyMonitoringStore[TRANSITIONS[status]](alert.id);
            if (!updatedAlert) {
                errorKeys[alert.id] = safetyMonitoringStore.errors.at(-1)?.code
                    ?? 'errors.earlyWarningAlertActionFailed';
            }
        } finally {
            pending[alert.id] = false;
        }
    }

    function userLabel(userId) {
        if (userId == null) return t('earlyWarningAlerts.audit.unknownUser');
        if (userId === iamStore.user?.id) return t('earlyWarningAlerts.audit.you');
        const user = iamStore.users.find((item) => item.id === userId);
        return user?.name || user?.username || t('earlyWarningAlerts.audit.user', { id: userId });
    }

    return { errorKeys, pending, changeStatus, userLabel };
}
