<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from './shared/presentation/components/AppLayout.vue';

const route = useRoute();

const workspace = computed(() => (
    route.meta.workspace ?? null
));
</script>

<template>
  <router-view v-if="workspace === null" />

  <AppLayout
      v-else
      :workspace="workspace"
  >
    <router-view />
  </AppLayout>
</template>