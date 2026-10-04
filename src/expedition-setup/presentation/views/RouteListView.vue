<script setup>
import { computed, onMounted, ref, toRefs } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const { routes, errors, routesLoaded } = toRefs(store);
const { fetchRoutes } = store;

const searchQuery = ref('');
const selectedDifficulty = ref('all');
const selectedStatus = ref('all');

const difficultyOptions = computed(() => [
  { label: t('routes.allDifficulties'), value: 'all' },
  { label: t('routes.difficulty.Beginner'), value: 'Beginner' },
  { label: t('routes.difficulty.Intermediate'), value: 'Intermediate' },
  { label: t('routes.difficulty.Advanced'), value: 'Advanced' },
  { label: t('routes.difficulty.Expert'), value: 'Expert' },
]);

const statusOptions = computed(() => [
  { label: t('routes.allStatuses'), value: 'all' },
  { label: t('routes.status.draft'), value: 'draft' },
]);

const filteredRoutes = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase();

  return routes.value.filter((route) => {
    const matchesSearch = !normalizedQuery
        || route.name.toLocaleLowerCase().includes(normalizedQuery)
        || route.origin.toLocaleLowerCase().includes(normalizedQuery)
        || route.destination.toLocaleLowerCase().includes(normalizedQuery);

    const matchesDifficulty = selectedDifficulty.value === 'all'
        || route.difficulty === selectedDifficulty.value;

    const matchesStatus = selectedStatus.value === 'all'
        || route.status === selectedStatus.value;

    return matchesSearch && matchesDifficulty && matchesStatus;
  });
});

onMounted(() => {
  if (!store.routesLoaded) {
    fetchRoutes();
  }
});

function navigateToNewRoute() {
  router.push({ name: 'route-new' });
}

function clearFilters() {
  searchQuery.value = '';
  selectedDifficulty.value = 'all';
  selectedStatus.value = 'all';
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) {
    return '—';
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);

  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

function getStatusLabel(status) {
  return t(`routes.status.${status}`);
}

function getDifficultyLabel(difficulty) {
  return t(`routes.difficulty.${difficulty}`);
}

function getDifficultyClass(difficulty) {
  return `difficulty-${difficulty.toLocaleLowerCase()}`;
}

function goToCheckpoints(routeId) {
  router.push({
    name: 'route-checkpoints',
    params: { routeId },
  });
}

function goToGroups(routeId) {
  router.push({
    name: 'route-groups',
    params: { routeId },
  });
}
</script>

<template>
  <section class="routes-page">
    <header class="page-header">
      <div>
        <div class="title-row">
          <h1>{{ t('routes.title') }}</h1>
          <span class="routes-count">
            {{ t('routes.registeredCount', { count: routes.length }) }}
          </span>
        </div>

        <p>{{ t('routes.description') }}</p>
      </div>

      <pv-button
          :label="t('common.newRoute')"
          icon="pi pi-plus"
          @click="navigateToNewRoute"
      />
    </header>

    <section class="filters-card" :aria-label="t('routes.title')">
      <div class="search-field">
        <i class="pi pi-search" aria-hidden="true" />
        <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('routes.searchPlaceholder')"
            :aria-label="t('routes.searchPlaceholder')"
        >
      </div>

      <div class="filter-control">
        <label for="difficulty-filter">
          {{ t('routes.difficultyFilter') }}
        </label>

        <pv-select
            id="difficulty-filter"
            v-model="selectedDifficulty"
            :options="difficultyOptions"
            option-label="label"
            option-value="value"
            class="w-full"
        />
      </div>

      <div class="filter-control">
        <label for="status-filter">
          {{ t('routes.statusFilter') }}
        </label>

        <pv-select
            id="status-filter"
            v-model="selectedStatus"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            class="w-full"
        />
      </div>

      <div class="filter-summary">
        <span>
          {{ t('routes.showing', {
          filtered: filteredRoutes.length,
          total: routes.length
        }) }}
        </span>

        <button type="button" class="clear-filters" @click="clearFilters">
          {{ t('common.resetFilters') }}
        </button>
      </div>
    </section>

    <div v-if="!routesLoaded" class="loading-state">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="filteredRoutes.length" class="route-grid">
      <article
          v-for="route in filteredRoutes"
          :key="route.id"
          class="route-card"
      >
        <div class="route-card-header">
          <pv-tag
              :value="getStatusLabel(route.status)"
              icon="pi pi-clock"
              severity="warn"
          />

          <span class="route-draft-label">
            {{ t('routes.routeSetup') }}
          </span>
        </div>

        <h2>{{ route.name }}</h2>

        <p class="route-location">
          {{ route.origin }}
          <i class="pi pi-arrow-right" aria-hidden="true" />
          {{ route.destination }}
        </p>

        <div class="route-details">
          <div>
            <span>{{ t('routes.difficultyFilter') }}</span>
            <strong :class="getDifficultyClass(route.difficulty)">
              <i class="pi pi-mountain" aria-hidden="true" />
              {{ getDifficultyLabel(route.difficulty) }}
            </strong>
          </div>

          <div>
            <span>{{ t('routes.distance') }}</span>
            <strong>
              <i class="pi pi-map-marker" aria-hidden="true" />
              {{ route.distanceKm }} km
            </strong>
          </div>

          <div>
            <span>{{ t('routes.elevationGain') }}</span>
            <strong>
              <i class="pi pi-chart-line" aria-hidden="true" />
              {{ route.elevationGainMeters }} m
            </strong>
          </div>

          <div>
            <span>{{ t('routes.estimatedDuration') }}</span>
            <strong>
              <i class="pi pi-clock" aria-hidden="true" />
              {{ formatDuration(route.estimatedDurationMinutes) }}
            </strong>
          </div>
        </div>

        <div class="route-card-footer">
          <span>
            <i class="pi pi-info-circle" aria-hidden="true" />
            {{ t('routes.addCheckpoints') }}
          </span>
        </div>

        <div class="route-card-actions">
          <pv-button
              :label="t('common.configureCheckpoints')"
              icon="pi pi-map-marker"
              severity="secondary"
              outlined
              @click="goToCheckpoints(route.id)"
          />

          <pv-button
              v-if="route.status === 'enabled'"
              :label="t('common.manageGroups')"
              icon="pi pi-users"
              severity="secondary"
              outlined
              @click="goToGroups(route.id)"
          />
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <i class="pi pi-map" aria-hidden="true" />
      <h2>{{ t('routes.noRoutesFound') }}</h2>
      <p>{{ t('routes.noRoutesDescription') }}</p>
      <pv-button
          :label="t('common.newRoute')"
          icon="pi pi-plus"
          @click="navigateToNewRoute"
      />
    </div>

    <p v-if="errors.length" class="request-error">
      {{ t(errors[errors.length - 1].code ?? 'errors.routeCreationFailed') }}
    </p>
  </section>
</template>
<style scoped>
.routes-page {
  color: var(--vt-text);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--vt-border);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.5rem);
  line-height: 1.15;
}

.page-header p {
  margin: 0.5rem 0 0;
  color: var(--vt-muted);
  font-size: 1rem;
}

.routes-count {
  padding: 0.3rem 0.75rem;
  border: 1px solid #aadfe0;
  border-radius: 9999px;
  background: #e7f8f8;
  color: var(--vt-teal);
  font-size: 0.82rem;
  font-weight: 700;
}

.filters-card {
  display: grid;
  grid-template-columns: minmax(15rem, 1.6fr) minmax(11rem, 0.8fr) minmax(11rem, 0.8fr);
  gap: 1rem;
  align-items: end;
  margin: 1.75rem 0;
  padding: 1.25rem;
  border: 1px solid var(--vt-border);
  border-radius: var(--vt-radius-card);
  background: var(--vt-surface);
  box-shadow: var(--vt-shadow);
}

.search-field {
  display: flex;
  align-items: center;
  min-height: 3rem;
  gap: 0.75rem;
  padding: 0 1rem;
  border: 1px solid var(--vt-border);
  border-radius: var(--vt-radius-input);
  background: #ffffff;
}

.search-field:focus-within {
  border-color: var(--vt-teal);
  box-shadow: 0 0 0 3px rgba(28, 124, 125, 0.2);
}

.search-field i {
  color: var(--vt-muted);
}

.search-field input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--vt-text);
}

.filter-control label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--vt-muted);
  font-size: 0.8rem;
  font-weight: 700;
}

.filter-summary {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  color: var(--vt-muted);
  font-size: 0.85rem;
}

.clear-filters {
  border: 0;
  background: transparent;
  color: var(--vt-teal);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
}

.route-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
}

.route-card {
  display: flex;
  flex-direction: column;
  min-height: 21rem;
  padding: 1.5rem;
  border: 1px solid var(--vt-border);
  border-radius: var(--vt-radius-card);
  background: var(--vt-surface);
}

.route-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.route-draft-label {
  color: var(--vt-muted);
  font-size: 0.8rem;
  font-weight: 700;
}

.route-card h2 {
  margin: 1.5rem 0 0.75rem;
  color: var(--vt-primary);
  font-size: 1.35rem;
  line-height: 1.3;
}

.route-location {
  min-height: 3rem;
  margin: 0;
  color: var(--vt-muted);
  line-height: 1.5;
}

.route-location i {
  margin: 0 0.25rem;
  color: var(--vt-teal);
  font-size: 0.75rem;
}

.route-details {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 0.875rem;
  background: var(--vt-surface-soft);
}

.route-details div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.route-details span {
  color: var(--vt-muted);
  font-size: 0.82rem;
}

.route-details strong {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--vt-text);
  font-size: 0.85rem;
  text-align: right;
}

.route-details .difficulty-beginner {
  color: #208661;
}

.route-details .difficulty-intermediate {
  color: var(--vt-teal);
}

.route-details .difficulty-advanced {
  color: #b66c00;
}

.route-details .difficulty-expert {
  color: var(--vt-danger);
}

.route-card-footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--vt-border);
  color: var(--vt-muted);
  font-size: 0.8rem;
}

.route-card-footer span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.route-card-footer i {
  color: var(--vt-amber);
}

.route-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.loading-state,
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

.empty-state h2,
.empty-state p {
  margin: 0;
}

.request-error {
  margin-top: 1rem;
  color: var(--vt-danger);
  font-weight: 700;
}

@media (max-width: 1100px) {
  .route-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-header,
  .title-row,
  .filter-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .filters-card,
  .route-grid {
    grid-template-columns: 1fr;
  }

  .filter-summary {
    gap: 0.5rem;
  }

  .route-card {
    min-height: auto;
  }
}
</style>