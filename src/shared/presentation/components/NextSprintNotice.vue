<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
<template>
  <section class="vt-panel" role="status"><h2>{{ t('workflow.nextSprint') }}</h2><p>{{ t('workflow.nextSprintDescription') }}</p></section>
</template>
