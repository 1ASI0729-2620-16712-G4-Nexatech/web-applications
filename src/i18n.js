import { createI18n } from 'vue-i18n';
import { watch } from 'vue';
import en from './locales/en.json';
import es from './locales/es.json';

const localeStorageKey = 'vitaltrek-locale';
const savedLocale = localStorage.getItem(localeStorageKey);

const initialLocale = ['en', 'es'].includes(savedLocale)
    ? savedLocale
    : 'en';

const i18n = createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'en',
    messages: { en, es },
});

watch(i18n.global.locale, (locale) => { document.documentElement.lang = locale === 'es' ? 'es-419' : 'en-US'; }, { immediate: true });

export default i18n;
