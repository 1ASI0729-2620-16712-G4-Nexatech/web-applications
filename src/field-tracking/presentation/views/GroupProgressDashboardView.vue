<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import useExpeditionSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import useFieldTrackingStore from '../../application/field-tracking.store.js';

const { t } = useI18n();
const expeditionSetupStore = useExpeditionSetupStore();
const fieldTrackingStore = useFieldTrackingStore();

const isLoading = computed(() => (
    !expeditionSetupStore.expeditionGroupsLoaded
    || !fieldTrackingStore.groupProgressRecordsLoaded
));

const groupTrackingRows = computed(() => (
    expeditionSetupStore.expeditionGroups.map((expeditionGroup) => {
      const route = expeditionSetupStore.routes.find((currentRoute) => (
          currentRoute.id === expeditionGroup.routeId
      ));

      const progress = fieldTrackingStore.getGroupProgressByGroupId(
          expeditionGroup.id,
      );

      const isStale = Boolean(
          progress && fieldTrackingStore.isSynchronizationStale(
              progress.synchronizedAt,
          ),
      );

      return {
        expeditionGroup,
        routeName: route?.name ?? '',
        progress,
        isStale,
      };
    })
));

function getStatusLabel(status) {
  return t(`groupProgress.status.${status}`);
}

function getRiskLabel(riskLevel) {
  return t(`groupProgress.risk.${riskLevel}`);
}

onMounted(() => {
  Promise.all([
    expeditionSetupStore.fetchRoutes(),
    expeditionSetupStore.fetchExpeditionGroups(),
    fieldTrackingStore.fetchGroupProgressRecords(),
  ]);
});
</script>

<template>
  <section class="group-progress-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">{{ t('groupProgress.title') }}</p>
        <h1>{{ t('groupProgress.title') }}</h1>
        <p>{{ t('groupProgress.description') }}</p>
      </div>
    </header>

    <p v-if="isLoading" class="loading-message">
      {{ t('common.loading') }}
    </p>

    <template v-else>
      <div v-if="groupTrackingRows.length" class="tracking-grid">
        <article
            v-for="row in groupTrackingRows"
            :key="row.expeditionGroup.id"
            class="tracking-card"
        >
          <header class="tracking-card-header">
            <div>
              <h2>{{ row.expeditionGroup.name }}</h2>
              <p>{{ row.routeName }} · {{ row.expeditionGroup.departureDate }}</p>
            </div>

            <span
                v-if="row.progress"
                class="status-tag"
                :class="row.progress.status"
            >
              {{ getStatusLabel(row.progress.status) }}
            </span>
          </header>

          <div v-if="!row.progress" class="tour-not-active">
            <i class="pi pi-info-circle" />
            {{ t('groupProgress.tourNotActive') }}
          </div>

          <template v-else>
            <p v-if="row.isStale" class="stale-warning">
              <i class="pi pi-exclamation-triangle" />
              {{ t('groupProgress.staleWarning') }}
            </p>

            <div class="tracking-details">
              <div>
                <span>{{ t('groupProgress.lastConfirmedCheckpoint') }}</span>
                <strong>{{ row.progress.lastConfirmedCheckpointLabel }}</strong>
              </div>

              <div>
                <span>{{ t('groupProgress.currentSegment') }}</span>
                <strong>{{ row.progress.currentSegmentLabel }}</strong>
              </div>

              <div>
                <span>{{ t('groupProgress.estimatedProgress') }}</span>
                <strong>{{ row.progress.estimatedProgressPercentage }}%</strong>
              </div>

              <div>
                <span>{{ t('groupProgress.synchronizedAt') }}</span>
                <strong>{{ row.progress.synchronizedAt }}</strong>
              </div>
            </div>

            <span class="risk-tag" :class="row.progress.riskLevel">
              <i class="pi pi-shield" />
              {{ getRiskLabel(row.progress.riskLevel) }}
            </span>
          </template>
        </article>
      </div>

      <div v-else class="empty-state">
        <i class="pi pi-compass" />
        <h2>{{ t('groupProgress.noGroups') }}</h2>
      </div>
    </template>
  </section>
</template>

<style scoped>
.group-progress-view {
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

.tracking-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
}

.tracking-card {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.tracking-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.tracking-card-header h2 {
  margin-bottom: 0.3rem;
  font-size: 1.2rem;
}

.tracking-card-header p {
  color: var(--vt-muted);
  font-size: 0.85rem;
}

.status-tag,
.risk-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-tag.on-track {
  background: #e6f8ef;
  color: #157347;
}

.status-tag.delayed {
  background: #fff4dc;
  color: #9b5b00;
}

.risk-tag {
  justify-self: start;
}

.risk-tag.low {
  background: #e6f8ef;
  color: #157347;
}

.risk-tag.medium {
  background: #fff4dc;
  color: #9b5b00;
}

.risk-tag.high {
  background: #fdeceb;
  color: var(--vt-danger);
}

.tour-not-active {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--vt-surface-soft);
  color: var(--vt-muted);
  font-size: 0.85rem;
}

.stale-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9b5b00;
  font-size: 0.82rem;
  font-weight: 700;
}

.tracking-details {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.875rem;
  background: var(--vt-surface-soft);
}

.tracking-details div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tracking-details span {
  color: var(--vt-muted);
  font-size: 0.82rem;
}

.tracking-details strong {
  color: var(--vt-text);
  font-size: 0.85rem;
  text-align: right;
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
  .group-progress-view {
    padding: 2rem 1.25rem;
  }

  .tracking-grid {
    grid-template-columns: 1fr;
  }
}
</style>
