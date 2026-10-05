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
  <div class="language-switcher">
    <label for="language-selector" class="sr-only">
      {{ t('language.selector') }}
    </label>

    <pv-select
        id="language-selector"
        v-model="selectedLocale"
        :options="languageOptions"
        option-label="label"
        option-value="value"
        class="language-select"
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