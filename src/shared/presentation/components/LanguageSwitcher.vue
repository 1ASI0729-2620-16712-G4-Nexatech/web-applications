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
.language-switcher {
  display: inline-flex;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.25rem;
  border-radius: 6px;
}

:deep(.lang-btn) {
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(.lang-btn:hover) {
  background: rgba(255, 255, 255, 0.15);
}

:deep(.lang-btn.is-active) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
}
</style>