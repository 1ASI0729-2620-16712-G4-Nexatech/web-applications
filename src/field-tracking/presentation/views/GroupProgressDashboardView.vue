<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useExpeditionSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import useFieldTrackingStore from '../../application/field-tracking.store.js';
import TrackingProgressSummary from '../components/TrackingProgressSummary.vue';

const { t } = useI18n();
const setup = useExpeditionSetupStore();
const tracking = useFieldTrackingStore();
const loading = ref(true);
const failed = ref(false);
const rows = computed(() => setup.expeditionGroups.map((group) => ({
    group,
    routeName: setup.routes.find((route) => route.id === group.routeId)?.name,
    entry: tracking.entries[group.id],
})));

async function load() {
    loading.value = true;
    failed.value = false;
    setup.clearErrors();
    try {
        await Promise.all([setup.fetchRoutes(), setup.fetchExpeditionGroups()]);
        if (setup.errors.length) {
            failed.value = true;
            return;
        }
        const groupsWithTracking = setup.expeditionGroups.filter((group) => ['active', 'finished'].includes(group.status));
        await Promise.all(groupsWithTracking.map((group) => tracking.fetchGroupProgress(group)));
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>

<template>
  <section class="vt-page">
    <header class="vt-page-header">
      <div>
        <h1>{{ t('groupProgress.title') }}</h1>
        <p>{{ t('groupProgress.description') }}</p>
      </div>
      <button class="vt-button secondary" :disabled="loading" @click="load">{{ t('workflow.refresh') }}</button>
    </header>

    <p v-if="failed" class="vt-notice" role="alert">{{ t('workflow.errors.requestFailed') }}</p>
    <p v-else-if="loading && !rows.length" class="vt-muted" role="status">{{ t('common.loading') }}</p>
    <p v-else-if="!rows.length" class="vt-notice">{{ t('groupProgress.noGroups') }}</p>
    <div v-else class="vt-grid">
      <article v-for="row in rows" :key="row.group.id" class="vt-panel">
        <header class="vt-page-header">
          <div>
            <h2>{{ row.group.name }}</h2>
            <p>{{ row.routeName }} · {{ row.group.departureDate }}</p>
          </div>
          <span class="vt-badge">{{ t(`workflow.status.${row.group.status}`) }}</span>
        </header>
        <TrackingProgressSummary :entry="row.entry" :loading="Boolean(tracking.loading[row.group.id])" />
      </article>
    </div>
  </section>
</template>
