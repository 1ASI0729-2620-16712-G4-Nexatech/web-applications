import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import es from './locales/es.json';

const localeStorageKey = 'vitaltrek-locale';
const savedLocale = localStorage.getItem(localeStorageKey);

const initialLocale = ['en', 'es'].includes(savedLocale)
    ? savedLocale
    : 'es';

const i18n = createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'es',
    messages: { en, es },
});

export default i18n;