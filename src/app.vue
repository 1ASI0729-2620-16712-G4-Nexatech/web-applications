<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from './shared/presentation/components/AppLayout.vue';

const route = useRoute();

/**
 * Workspace declared by the active route.
 * Routes outside a workspace, such as the role selection view, return null
 * and are rendered without the workspace layout.
 */
const workspace = computed(() => route.meta.workspace ?? null);
</script>

<template>
  <AppLayout v-if="workspace" :workspace="workspace">
    <router-view />
  </AppLayout>

  <router-view v-else />
</template>
