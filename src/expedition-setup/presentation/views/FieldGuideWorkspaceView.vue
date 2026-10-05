<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const selectedFieldGuideId = ref(null);

const isLoading = computed(() => (
    !store.routesLoaded
    || !store.expeditionGroupsLoaded
    || !store.fieldGuidesLoaded
));

const assignedGroups = computed(() => (
    store.expeditionGroups.filter((group) => (
        group.fieldGuideId === selectedFieldGuideId.value
    ))
));

function getRouteName(routeId) {
  return store.routes.find((route) => route.id === routeId)?.name ?? '—';
}

function goToManifest(expeditionGroup) {
  router.push({
    name: 'field-guide-manifest',
    params: { groupId: expeditionGroup.id },
  });
}

onMounted(() => {
  Promise.all([
    store.fetchRoutes(),
    store.fetchExpeditionGroups(),
    store.fetchFieldGuides(),
  ]).then(() => {
    selectedFieldGuideId.value = store.fieldGuides[0]?.id ?? null;
  });
});
</script>

<template>
  <section class="field-guide-workspace">
    <header class="view-header">
      <div>
        <p class="eyebrow">{{ t('fieldGuideWorkspace.title') }}</p>
        <h1>{{ t('fieldGuideWorkspace.title') }}</h1>
        <p>{{ t('fieldGuideWorkspace.description') }}</p>
      </div>
    </header>

    <p v-if="isLoading" class="loading-message">
      {{ t('common.loading') }}
    </p>

    <template v-else>
      <section class="guide-selector-card">
        <div>
          <h2>{{ t('fieldGuideWorkspace.demoGuideLabel') }}</h2>
          <p>{{ t('fieldGuideWorkspace.description') }}</p>
        </div>

        <pv-select
            v-model="selectedFieldGuideId"
            :options="store.fieldGuides"
            option-label="name"
            option-value="id"
            :placeholder="t('fieldGuideWorkspace.demoGuidePlaceholder')"
            class="guide-selector"
        />
      </section>

      <section class="groups-card">
        <header class="groups-card-header">
          <div>
            <h2>{{ t('fieldGuideWorkspace.assignedGroups') }}</h2>
            <p>
              {{
                t('fieldGuideWorkspace.registeredCount', {
                  count: assignedGroups.length,
                })
              }}
            </p>
          </div>

          <i class="pi pi-users groups-icon" />
        </header>

        <div v-if="assignedGroups.length" class="groups-list">
          <article
              v-for="group in assignedGroups"
              :key="group.id"
              class="group-item"
          >
            <div>
              <h3>{{ group.name }}</h3>

              <dl class="group-details">
                <div>
                  <dt>{{ t('fieldGuideWorkspace.route') }}</dt>
                  <dd>{{ getRouteName(group.routeId) }}</dd>
                </div>

                <div>
                  <dt>{{ t('fieldGuideWorkspace.departureDate') }}</dt>
                  <dd>{{ group.departureDate }}</dd>
                </div>

                <div>
                  <dt>{{ t('fieldGuideWorkspace.capacity') }}</dt>
                  <dd>{{ group.maximumCapacity }}</dd>
                </div>
              </dl>
            </div>

            <pv-button
                :label="t('fieldGuideWorkspace.openManifest')"
                icon="pi pi-id-card"
                @click="goToManifest(group)"
            />
          </article>
        </div>

        <div v-else class="empty-state">
          <i class="pi pi-users" />
          <h3>{{ t('fieldGuideWorkspace.noGroups') }}</h3>
          <p>{{ t('fieldGuideWorkspace.noGroupsDescription') }}</p>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.field-guide-workspace {
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

.view-header p,
.guide-selector-card p,
.groups-card-header p,
.empty-state p {
  color: var(--vt-muted);
}

.loading-message {
  color: var(--vt-muted);
}

.guide-selector-card,
.groups-card {
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.guide-selector-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
}

.guide-selector-card h2 {
  margin-bottom: 0.35rem;
  font-size: 1.15rem;
}

.guide-selector-card p {
  margin-bottom: 0;
}

.guide-selector {
  width: min(100%, 22rem);
}

.groups-card {
  padding: 1.5rem;
}

.groups-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--vt-border);
}

.groups-card-header h2 {
  margin-bottom: 0.35rem;
  font-size: 1.25rem;
}

.groups-card-header p {
  margin-bottom: 0;
}

.groups-icon {
  color: var(--vt-teal);
  font-size: 1.4rem;
}

.groups-list {
  display: grid;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--vt-border);
}

.group-item:last-child {
  border-bottom: 0;
}

.group-item h3 {
  margin-bottom: 0.9rem;
  font-size: 1.1rem;
}

.group-details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 2rem;
  margin: 0;
}

.group-details div {
  display: grid;
  gap: 0.2rem;
}

.group-details dt {
  color: var(--vt-muted);
  font-size: 0.75rem;
}

.group-details dd {
  margin: 0;
  color: var(--vt-text);
  font-size: 0.85rem;
  font-weight: 700;
}

.empty-state {
  padding: 3.5rem 1rem;
  text-align: center;
}

.empty-state i {
  margin-bottom: 0.9rem;
  color: var(--vt-teal);
  font-size: 2rem;
}

.empty-state h3 {
  margin-bottom: 0.4rem;
}

.empty-state p {
  margin-bottom: 0;
}

@media (max-width: 700px) {
  .field-guide-workspace {
    padding: 2rem 1.25rem;
  }

  .guide-selector-card,
  .group-item {
    align-items: stretch;
    flex-direction: column;
  }

  .guide-selector {
    width: 100%;
  }
}
</style>