<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useSetupStore from './expedition-setup/application/expedition-setup.store.js';
import useSafetyStore from './safety-monitoring/application/safety-monitoring.store.js';
import useTrackingStore from './field-tracking/application/field-tracking.store.js';
import AppLayout from './shared/presentation/components/AppLayout.vue';

const route = useRoute();
const { t } = useI18n();
const setup = useSetupStore(), safety = useSafetyStore(), tracking = useTrackingStore();
const failures = computed(() => [...setup.errors, ...safety.errors, ...tracking.errors]);
function retry() { window.location.reload(); }

const workspace = computed(() => (
    route.meta.workspace ?? null
));
</script>

<template>
  <router-view v-if="workspace === null" :key="route.path" />

  <AppLayout
      v-else
      :workspace="workspace"
  >
<div v-if="failures.length" role="alert" class="vt-notice vt-error">{{ t(failures.at(-1).code) }} <button class="vt-link" @click="retry">{{ t('workflow.retry') }}</button></div>
    <router-view :key="route.path" />
  </AppLayout>
</template>