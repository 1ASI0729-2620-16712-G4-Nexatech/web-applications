<script setup>
import { computed, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import useExpeditionSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import useSafetyMonitoringStore from '../../application/safety-monitoring.store.js';

const { t } = useI18n();
const expeditionSetupStore = useExpeditionSetupStore();
const safetyMonitoringStore = useSafetyMonitoringStore();

const actionErrorKeys = reactive({});

const isLoading = computed(() => (
    !expeditionSetupStore.expeditionGroupsLoaded
    || !safetyMonitoringStore.earlyWarningAlertsLoaded
));

const groupAlertRows = computed(() => (
    expeditionSetupStore.expeditionGroups.map((expeditionGroup) => {
      const route = expeditionSetupStore.routes.find((currentRoute) => (
          currentRoute.id === expeditionGroup.routeId
      ));

      const alerts = safetyMonitoringStore.getEarlyWarningAlertsByGroupId(
          expeditionGroup.id,
      );

      return {
        expeditionGroup,
        routeName: route?.name ?? '',
        alerts,
      };
    }).filter((row) => row.alerts.length > 0)
));

function getTypeLabel(type) {
  return t(`earlyWarningAlerts.type.${type}`);
}

function getPriorityLabel(priority) {
  return t(`earlyWarningAlerts.priority.${priority}`);
}

function getStatusLabel(status) {
  return t(`earlyWarningAlerts.status.${status}`);
}

function acknowledgeAlert(alertId) {
  actionErrorKeys[alertId] = '';
  safetyMonitoringStore.clearErrors();

  safetyMonitoringStore.acknowledgeAlert(alertId).then((updatedAlert) => {
    if (!updatedAlert) {
      actionErrorKeys[alertId] = safetyMonitoringStore.errors.at(-1)?.code
          ?? 'errors.earlyWarningAlertActionFailed';
    }
  });
}

function resolveAlert(alertId) {
  actionErrorKeys[alertId] = '';
  safetyMonitoringStore.clearErrors();

  safetyMonitoringStore.resolveAlert(alertId).then((updatedAlert) => {
    if (!updatedAlert) {
      actionErrorKeys[alertId] = safetyMonitoringStore.errors.at(-1)?.code
          ?? 'errors.earlyWarningAlertActionFailed';
    }
  });
}

function dismissAlertAsFalseAlarm(alertId) {
  actionErrorKeys[alertId] = '';
  safetyMonitoringStore.clearErrors();

  safetyMonitoringStore.dismissAlertAsFalseAlarm(alertId).then((updatedAlert) => {
    if (!updatedAlert) {
      actionErrorKeys[alertId] = safetyMonitoringStore.errors.at(-1)?.code
          ?? 'errors.earlyWarningAlertActionFailed';
    }
  });
}

onMounted(() => {
  Promise.all([
    expeditionSetupStore.fetchRoutes(),
    expeditionSetupStore.fetchExpeditionGroups(),
    safetyMonitoringStore.fetchEarlyWarningAlerts(),
  ]);
});
</script>

<template>
  <section class="early-warning-alert-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">{{ t('earlyWarningAlerts.title') }}</p>
        <h1>{{ t('earlyWarningAlerts.title') }}</h1>
        <p>{{ t('earlyWarningAlerts.description') }}</p>
      </div>

      <span class="active-count-tag">
        <i class="pi pi-bell" />
        {{
          t('earlyWarningAlerts.activeCount', {
            count: safetyMonitoringStore.activeEarlyWarningAlertsCount,
          })
        }}
      </span>
    </header>

    <p v-if="isLoading" class="loading-message">
      {{ t('common.loading') }}
    </p>

    <template v-else>
      <div v-if="groupAlertRows.length" class="alert-groups">
        <article
            v-for="row in groupAlertRows"
            :key="row.expeditionGroup.id"
            class="alert-group-card"
        >
          <header class="alert-group-header">
            <div>
              <h2>{{ row.expeditionGroup.name }}</h2>
              <p>{{ row.routeName }} · {{ row.expeditionGroup.departureDate }}</p>
            </div>
          </header>

          <div class="alert-list">
            <article
                v-for="alert in row.alerts"
                :key="alert.id"
                class="alert-item"
            >
              <div class="alert-item-header">
                <div class="alert-item-tags">
                  <span class="priority-tag" :class="alert.priority">
                    <i class="pi pi-exclamation-triangle" />
                    {{ getPriorityLabel(alert.priority) }}
                  </span>

                  <span class="status-tag" :class="alert.status">
                    {{ getStatusLabel(alert.status) }}
                  </span>
                </div>

                <span class="alert-triggered-at">{{ alert.triggeredAt }}</span>
              </div>

              <h3>{{ getTypeLabel(alert.type) }}</h3>

              <div v-if="alert.riskEvidence.length" class="evidence-list">
                <div
                    v-for="(evidence, index) in alert.riskEvidence"
                    :key="index"
                    class="evidence-item"
                >
                  <span>{{ evidence.metricType }}</span>
                  <strong>
                    {{ t('earlyWarningAlerts.observedValue') }}: {{ evidence.observedValue }}
                    ·
                    {{ t('earlyWarningAlerts.expectedValue') }}: {{ evidence.expectedValue }}
                  </strong>
                </div>
              </div>

              <p v-if="actionErrorKeys[alert.id]" class="request-error">
                {{ t(actionErrorKeys[alert.id]) }}
              </p>

              <div
                  v-if="safetyMonitoringStore.isAlertActionable(alert.status)"
                  class="alert-actions"
              >
                <pv-button
                    v-if="alert.status === 'active'"
                    type="button"
                    :label="t('earlyWarningAlerts.acknowledge')"
                    size="small"
                    severity="secondary"
                    outlined
                    @click="acknowledgeAlert(alert.id)"
                />

                <pv-button
                    type="button"
                    :label="t('earlyWarningAlerts.resolve')"
                    size="small"
                    @click="resolveAlert(alert.id)"
                />

                <pv-button
                    type="button"
                    :label="t('earlyWarningAlerts.dismissAsFalseAlarm')"
                    size="small"
                    severity="danger"
                    outlined
                    @click="dismissAlertAsFalseAlarm(alert.id)"
                />
              </div>
            </article>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <i class="pi pi-shield" />
        <h2>{{ t('earlyWarningAlerts.noAlerts') }}</h2>
        <p>{{ t('earlyWarningAlerts.noAlertsDescription') }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.early-warning-alert-view {
  max-width: 1120px;
  margin: 0 auto;
  padding: 3rem 2rem;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.eyebrow {
  margin: 0 0 0.55rem;
  color: var(--vt-teal);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1,
h2,
h3 {
  color: var(--vt-text);
}

.view-header h1 {
  margin-bottom: 0.55rem;
  font-size: clamp(2.1rem, 4vw, 3rem);
}

.view-header p {
  color: var(--vt-muted);
}

.active-count-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  background: #fdeceb;
  color: var(--vt-danger);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.loading-message {
  color: var(--vt-muted);
}

.alert-groups {
  display: grid;
  gap: 1.5rem;
}

.alert-group-card {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.alert-group-header h2 {
  margin-bottom: 0.3rem;
  font-size: 1.2rem;
}

.alert-group-header p {
  color: var(--vt-muted);
  font-size: 0.85rem;
}

.alert-list {
  display: grid;
  gap: 0.9rem;
}

.alert-item {
  display: grid;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--vt-border);
  border-radius: 0.875rem;
  background: var(--vt-surface-soft);
}

.alert-item h3 {
  font-size: 1rem;
}

.alert-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.alert-item-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-triggered-at {
  color: var(--vt-muted);
  font-size: 0.78rem;
}

.priority-tag,
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.priority-tag.low {
  background: #e6f8ef;
  color: #157347;
}

.priority-tag.medium {
  background: #fff4dc;
  color: #9b5b00;
}

.priority-tag.high {
  background: #fdeceb;
  color: var(--vt-danger);
}

.status-tag.active {
  background: #fdeceb;
  color: var(--vt-danger);
}

.status-tag.acknowledged {
  background: #fff4dc;
  color: #9b5b00;
}

.status-tag.resolved,
.status-tag.dismissed {
  background: #e6f8ef;
  color: #157347;
}

.evidence-list {
  display: grid;
  gap: 0.4rem;
}

.evidence-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.82rem;
}

.evidence-item span {
  color: var(--vt-muted);
}

.evidence-item strong {
  color: var(--vt-text);
  text-align: right;
}

.request-error {
  margin: 0;
  color: #b42318;
  font-size: 0.8rem;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.empty-state {
  display: grid;
  min-height: 16rem;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  padding: 2rem;
  border: 1px dashed var(--vt-border);
  border-radius: var(--vt-radius-card);
  color: var(--vt-muted);
  text-align: center;
}

.empty-state i {
  color: var(--vt-teal);
  font-size: 2rem;
}

@media (max-width: 760px) {
  .early-warning-alert-view {
    padding: 2rem 1.25rem;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
  }

  .alert-item-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .alert-actions {
    justify-content: flex-start;
  }
}
</style>
