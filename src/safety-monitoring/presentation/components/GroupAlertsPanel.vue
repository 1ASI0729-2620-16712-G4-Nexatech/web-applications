<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useSafetyMonitoringStore from '../../application/safety-monitoring.store.js';
import EarlyWarningAlertCard from './EarlyWarningAlertCard.vue';
import { useAlertActions } from '../use-alert-actions.js';

/**
 * Alerts of the current tracking session of a group, closed ones included, so the field guide or the administrator
 * can attend them from the expedition workspace. The server raises them; this panel only reads and acts on them.
 */
const props = defineProps({
  group: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  sessionId: { type: Number, default: null },
  sessionActive: { type: Boolean, default: false },
});

const { t } = useI18n();
const safetyMonitoringStore = useSafetyMonitoringStore();
const { errorKeys, pending, changeStatus, userLabel } = useAlertActions();
const loading = ref(false);
const evaluationErrorKey = ref('');

const alerts = computed(() => (
  safetyMonitoringStore.getEarlyWarningAlertsByGroupId(props.group.id)
      .filter((alert) => alert.sessionId === props.sessionId)
));

function memberName(alert) {
  if (alert.memberId == null) return '';
  return props.members.find((member) => member.id === alert.memberId)?.fullName
      ?? t('earlyWarningAlerts.participant', { id: alert.memberId });
}

async function run(action) {
  loading.value = true;
  evaluationErrorKey.value = '';
  safetyMonitoringStore.clearErrors();
  try {
    await action();
    evaluationErrorKey.value = safetyMonitoringStore.errors.at(-1)?.code ?? '';
  } finally {
    loading.value = false;
  }
}

function refresh() {
  return run(() => safetyMonitoringStore.fetchAlertsForSession(props.sessionId));
}

function evaluateNow() {
  return run(() => safetyMonitoringStore.requestEvaluation(props.sessionId));
}
</script>

<template>
  <section class="vt-panel group-alerts">
    <header class="group-alerts-header">
      <h2>{{ t('earlyWarningAlerts.sessionTitle') }}</h2>
      <div v-if="sessionId" class="group-alerts-actions">
        <button class="vt-button secondary" type="button" :disabled="loading" @click="refresh">
          {{ t('earlyWarningAlerts.refresh') }}
        </button>
        <button v-if="safetyMonitoringStore.canManageAlerts && sessionActive" class="vt-button secondary" type="button"
                :disabled="loading" @click="evaluateNow">
          {{ t('earlyWarningAlerts.evaluateNow') }}
        </button>
      </div>
    </header>

    <p v-if="!sessionId" class="vt-notice" role="status">{{ t('earlyWarningAlerts.noSession') }}</p>
    <template v-else>
      <p v-if="evaluationErrorKey" class="request-error" role="alert">{{ t(evaluationErrorKey) }}</p>
      <div v-if="alerts.length" class="group-alerts-list">
        <EarlyWarningAlertCard
            v-for="alert in alerts"
            :key="alert.id"
            :alert="alert"
            :member-name="memberName(alert)"
            :can-manage="safetyMonitoringStore.canManageAlerts"
            :busy="Boolean(pending[alert.id])"
            :error-key="errorKeys[alert.id] ?? ''"
            :user-label="userLabel"
            @change-status="(status) => changeStatus(alert, status)"
        />
      </div>
      <p v-else class="empty-hint">{{ t('earlyWarningAlerts.noSessionAlerts') }}</p>
    </template>
  </section>
</template>

<style scoped>
.group-alerts {
  display: grid;
  gap: 1rem;
}

.group-alerts-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.group-alerts-header h2,
.empty-hint,
.request-error {
  margin: 0;
}

.group-alerts-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.group-alerts-list {
  display: grid;
  gap: 0.9rem;
}

.empty-hint {
  color: var(--vt-muted);
}

.request-error {
  color: #b42318;
  font-size: 0.85rem;
}
</style>
