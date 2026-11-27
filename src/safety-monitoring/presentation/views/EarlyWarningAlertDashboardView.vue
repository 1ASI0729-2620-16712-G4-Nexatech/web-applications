<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import useExpeditionSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import useIamStore from '../../../iam/application/iam.store.js';
import useSafetyMonitoringStore from '../../application/safety-monitoring.store.js';
import EarlyWarningAlertCard from '../components/EarlyWarningAlertCard.vue';
import { useAlertActions } from '../use-alert-actions.js';

const { t } = useI18n();
const expeditionSetupStore = useExpeditionSetupStore();
const iamStore = useIamStore();
const safetyMonitoringStore = useSafetyMonitoringStore();
const { errorKeys, pending, changeStatus, userLabel } = useAlertActions();

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

      // Alerts are sorted by urgency, so the first open one carries the current risk of the group.
      const highestOpenAlert = alerts.find((alert) => alert.isOpen);

      return {
        expeditionGroup,
        routeName: route?.name ?? '',
        risk: highestOpenAlert?.priority ?? '',
        alerts,
      };
    }).filter((row) => row.alerts.length > 0)
));

function memberName(alert) {
  if (alert.memberId == null) return '';
  return expeditionSetupStore.manifestEntries.find((entry) => entry.id === alert.memberId)?.fullName
      ?? t('earlyWarningAlerts.participant', { id: alert.memberId });
}

function refresh() {
  return safetyMonitoringStore.fetchEarlyWarningAlerts();
}

onMounted(() => {
  Promise.all([
    expeditionSetupStore.fetchRoutes(),
    expeditionSetupStore.fetchExpeditionGroups(),
    expeditionSetupStore.fetchManifestEntries(),
    safetyMonitoringStore.fetchEarlyWarningAlerts(),
    // Names of the users in the audit; only an administrator can read the accounts of the agency.
    ...(iamStore.isAdmin ? [iamStore.fetchUsers().catch(() => null)] : []),
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

      <div class="view-header-actions">
        <span class="active-count-tag">
          <i class="pi pi-bell" />
          {{
            t('earlyWarningAlerts.activeCount', {
              count: safetyMonitoringStore.activeEarlyWarningAlertsCount,
            })
          }}
        </span>
        <pv-button
            type="button"
            icon="pi pi-refresh"
            :label="t('earlyWarningAlerts.refresh')"
            size="small"
            severity="secondary"
            outlined
            :disabled="isLoading"
            @click="refresh"
        />
      </div>
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
            <span v-if="row.risk" class="group-risk-tag" :class="row.risk">
              {{ t('earlyWarningAlerts.groupRisk') }}: {{ t(`earlyWarningAlerts.priority.${row.risk}`) }}
            </span>
          </header>

          <div class="alert-list">
            <EarlyWarningAlertCard
                v-for="alert in row.alerts"
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

.view-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.alert-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.group-risk-tag {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.group-risk-tag.low {
  background: #e6f8ef;
  color: #157347;
}

.group-risk-tag.medium {
  background: #fff4dc;
  color: #9b5b00;
}

.group-risk-tag.high {
  background: #fdeceb;
  color: var(--vt-danger);
}

.group-risk-tag.critical {
  background: var(--vt-danger);
  color: #ffffff;
}

.alert-list {
  display: grid;
  gap: 0.9rem;
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

  .view-header,
  .alert-group-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
