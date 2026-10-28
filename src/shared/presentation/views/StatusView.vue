<script setup>
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
defineProps({ kind: { type: String, default: 'notFound' } });
const route = useRoute(), { t } = useI18n();
</script>
<template><main class="vt-page vt-panel"><h1>{{ t(`workflow.${kind}`) }}</h1><p>{{ t('workflow.statusHelp') }}</p><RouterLink class="vt-button" :to="kind === 'connectionError' && typeof route.query.retry === 'string' && route.query.retry.startsWith('/') && !route.query.retry.startsWith('//') ? route.query.retry : '/'">{{ t('workflow.retry') }}</RouterLink></main></template>
