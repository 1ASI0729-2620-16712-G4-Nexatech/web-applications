<script setup>
import { useI18n } from 'vue-i18n';
defineProps({ error: { type: String, default: '' }, message: { type: String, default: '' }, busy: Boolean });
const { t } = useI18n();
</script>
<template>
  <p v-if="error" class="vt-notice vt-error" role="alert">{{ t(error) }}</p>
  <p v-else-if="busy" class="vt-notice" role="status">{{ t('common.loading') }}</p>
  <p v-else-if="message" class="vt-notice" role="status">{{ t(message) }}</p>
</template>
