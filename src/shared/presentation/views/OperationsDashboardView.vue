<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import useExpeditionSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import useFieldTrackingStore from '../../../field-tracking/application/field-tracking.store.js';
import useSafetyMonitoringStore from '../../../safety-monitoring/application/safety-monitoring.store.js';

const { t } = useI18n();
const expeditionSetupStore = useExpeditionSetupStore();
const fieldTrackingStore = useFieldTrackingStore();
const safetyMonitoringStore = useSafetyMonitoringStore();

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const isLoading = computed(() => (
    !expeditionSetupStore.routesLoaded
    || !expeditionSetupStore.expeditionGroupsLoaded
    || !fieldTrackingStore.groupProgressRecordsLoaded
    || !safetyMonitoringStore.earlyWarningAlertsLoaded
));

const enabledRoutesCount = computed(() => (
    expeditionSetupStore.routes.filter((route) => route.status === 'enabled').length
));

const delayedGroupsCount = computed(() => (
    fieldTrackingStore.groupProgressRecords.filter(
        (progress) => progress.status === 'delayed',
    ).length
));

const statTiles = computed(() => ([
  {
    key: 'routes',
    icon: 'pi pi-map',
    tone: 'neutral',
    value: expeditionSetupStore.routesCount,
    label: t('operationsDashboard.stats.routes'),
    hint: t('operationsDashboard.stats.routesHint', {
      enabled: enabledRoutesCount.value,
      total: expeditionSetupStore.routesCount,
    }),
  },
  {
    key: 'groups',
    icon: 'pi pi-users',
    tone: 'neutral',
    value: expeditionSetupStore.expeditionGroups.length,
    label: t('operationsDashboard.stats.groups'),
    hint: '',
  },
  {
    key: 'delayed',
    icon: 'pi pi-exclamation-triangle',
    tone: delayedGroupsCount.value > 0 ? 'warning' : 'good',
    value: delayedGroupsCount.value,
    label: t('operationsDashboard.stats.delayedGroups'),
    hint: '',
  },
  {
    key: 'alerts',
    icon: 'pi pi-bell',
    tone: safetyMonitoringStore.activeEarlyWarningAlertsCount > 0 ? 'critical' : 'good',
    value: safetyMonitoringStore.activeEarlyWarningAlertsCount,
    label: t('operationsDashboard.stats.activeAlerts'),
    hint: '',
  },
]));

const topAlerts = computed(() => (
    safetyMonitoringStore.earlyWarningAlerts
        .filter((alert) => alert.status === 'active' || alert.status === 'acknowledged')
        .sort((first, second) => (
            PRIORITY_RANK[second.priority] - PRIORITY_RANK[first.priority]
        ))
        .slice(0, 3)
        .map((alert) => {
          const expeditionGroup = expeditionSetupStore.expeditionGroups.find(
              (currentGroup) => currentGroup.id === alert.expeditionGroupId,
          );

          return {
            alert,
            groupName: expeditionGroup?.name ?? '',
          };
        })
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

onMounted(() => {
  Promise.all([
    expeditionSetupStore.fetchRoutes(),
    expeditionSetupStore.fetchExpeditionGroups(),
    fieldTrackingStore.fetchGroupProgressRecords(),
    safetyMonitoringStore.fetchEarlyWarningAlerts(),
  ]);
});
</script>

<template>
  <section class="operations-dashboard-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">{{ t('operationsDashboard.eyebrow') }}</p>
        <h1>{{ t('operationsDashboard.title') }}</h1>
        <p>{{ t('operationsDashboard.description') }}</p>
      </div>
    </header>

    <p v-if="isLoading" class="loading-message">
      {{ t('common.loading') }}
    </p>

    <template v-else>
      <div class="stat-grid">
        <article
            v-for="tile in statTiles"
            :key="tile.key"
            class="stat-tile"
            :class="tile.tone"
        >
          <span class="stat-tile-icon">
            <i :class="tile.icon" />
          </span>

          <div>
            <strong class="stat-tile-value">{{ tile.value }}</strong>
            <p class="stat-tile-label">{{ tile.label }}</p>
            <p v-if="tile.hint" class="stat-tile-hint">{{ tile.hint }}</p>
          </div>
        </article>
      </div>

      <div class="shortcuts-grid">
        <RouterLink to="/operations/routes" class="shortcut-card">
          <span class="shortcut-icon">
            <i class="pi pi-map" />
          </span>

          <div>
            <h2>{{ t('operationsDashboard.shortcuts.routesTitle') }}</h2>
            <p>{{ t('operationsDashboard.shortcuts.routesDescription') }}</p>
          </div>

          <i class="pi pi-arrow-right shortcut-arrow" />
        </RouterLink>

        <RouterLink to="/operations/progress" class="shortcut-card">
          <span class="shortcut-icon">
            <i class="pi pi-chart-line" />
          </span>

          <div>
            <h2>{{ t('operationsDashboard.shortcuts.progressTitle') }}</h2>
            <p>{{ t('operationsDashboard.shortcuts.progressDescription') }}</p>
          </div>

          <i class="pi pi-arrow-right shortcut-arrow" />
        </RouterLink>

        <RouterLink to="/operations/alerts" class="shortcut-card">
          <span class="shortcut-icon">
            <i class="pi pi-bell" />
          </span>

          <div>
            <h2>{{ t('operationsDashboard.shortcuts.alertsTitle') }}</h2>
            <p>{{ t('operationsDashboard.shortcuts.alertsDescription') }}</p>
          </div>

          <i class="pi pi-arrow-right shortcut-arrow" />
        </RouterLink>
      </div>

      <section class="top-alerts-card">
        <header class="top-alerts-header">
          <h2>{{ t('operationsDashboard.topAlertsTitle') }}</h2>
          <RouterLink to="/operations/alerts" class="view-all-link">
            {{ t('operationsDashboard.viewAll') }}
          </RouterLink>
        </header>

        <div v-if="topAlerts.length" class="top-alerts-list">
          <article
              v-for="row in topAlerts"
              :key="row.alert.id"
              class="top-alert-item"
          >
            <span class="priority-tag" :class="row.alert.priority">
              <i class="pi pi-exclamation-triangle" />
              {{ getPriorityLabel(row.alert.priority) }}
            </span>

            <div class="top-alert-info">
              <strong>{{ row.groupName }}</strong>
              <p>{{ getTypeLabel(row.alert.type) }}</p>
            </div>

            <span class="status-tag" :class="row.alert.status">
              {{ getStatusLabel(row.alert.status) }}
            </span>
          </article>
        </div>

        <p v-else class="empty-hint">
          {{ t('operationsDashboard.topAlertsEmpty') }}
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.operations-dashboard-view {
  max-width: 1120px;
  margin: 0 auto;
  padding: 3rem 2rem;
}

.view-header {
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
p {
  margin-top: 0;
}

h1,
h2 {
  color: var(--vt-text);
}

.view-header h1 {
  margin-bottom: 0.55rem;
  font-size: clamp(2.1rem, 4vw, 3rem);
}

.view-header p {
  color: var(--vt-muted);
}

.loading-message {
  color: var(--vt-muted);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.stat-tile {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1.25rem;
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.stat-tile-icon {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  font-size: 1.1rem;
}

.stat-tile.neutral .stat-tile-icon {
  background: #e7f8f8;
  color: var(--vt-teal);
}

.stat-tile.good .stat-tile-icon {
  background: #e6f8ef;
  color: #157347;
}

.stat-tile.warning .stat-tile-icon {
  background: #fff4dc;
  color: #9b5b00;
}

.stat-tile.critical .stat-tile-icon {
  background: #fdeceb;
  color: var(--vt-danger);
}

.stat-tile-value {
  display: block;
  color: var(--vt-text);
  font-family: 'Sora', sans-serif;
  font-size: 1.9rem;
  line-height: 1.1;
}

.stat-tile-label {
  margin: 0.2rem 0 0;
  color: var(--vt-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.stat-tile-hint {
  margin: 0.2rem 0 0;
  color: var(--vt-muted);
  font-size: 0.76rem;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.shortcut-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.shortcut-card:hover {
  border-color: var(--vt-teal);
  transform: translateY(-2px);
}

.shortcut-icon {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--vt-primary);
  color: #ffffff;
}

.shortcut-card h2 {
  margin-bottom: 0.3rem;
  font-size: 1.05rem;
}

.shortcut-card p {
  margin: 0;
  color: var(--vt-muted);
  font-size: 0.8rem;
}

.shortcut-arrow {
  margin-left: auto;
  color: var(--vt-muted);
}

.top-alerts-card {
  padding: 1.5rem;
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.top-alerts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.1rem;
}

.top-alerts-header h2 {
  font-size: 1.1rem;
}

.view-all-link {
  color: var(--vt-teal);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
}

.top-alerts-list {
  display: grid;
  gap: 0.75rem;
}

.top-alert-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--vt-border);
}

.top-alert-item:last-child {
  border-bottom: 0;
}

.top-alert-info {
  flex: 1 1 auto;
}

.top-alert-info p {
  margin: 0.15rem 0 0;
  color: var(--vt-muted);
  font-size: 0.8rem;
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

.empty-hint {
  margin: 0;
  color: var(--vt-muted);
  font-size: 0.85rem;
}

@media (max-width: 960px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shortcuts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .operations-dashboard-view {
    padding: 2rem 1.25rem;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
