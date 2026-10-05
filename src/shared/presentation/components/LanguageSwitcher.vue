<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const localeStorageKey = 'vitaltrek-locale';
const { locale } = useI18n();

const currentLocale = computed(() => locale.value);

const setLocale = (newLocale) => {
  if (locale.value !== newLocale) {
    locale.value = newLocale;
    localStorage.setItem(localeStorageKey, newLocale);
  }
};
</script>

<template>
  <div class="language-switcher" role="group">
    <pv-button
      type="button"
      label="ES"
      :class="['lang-btn', { 'is-active': currentLocale === 'es' }]"
      @click="setLocale('es')"
    />
    <pv-button
      type="button"
      label="EN"
      :class="['lang-btn', { 'is-active': currentLocale === 'en' }]"
      @click="setLocale('en')"
    />
  </div>
</template>

<style scoped>
.language-select {
  width: 8rem;
}

:deep(.p-select) {
  min-height: 2.5rem;
  border-color: rgba(255, 255, 255, 0.35);
  background: transparent !important;
  color: #ffffff !important;
}

:deep(.p-select-label),
:deep(.p-select-dropdown) {
  color: #ffffff !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>