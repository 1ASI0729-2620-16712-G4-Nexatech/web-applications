import i18n from '../../i18n.js';
import { readSession, saveSession } from './iam-session.js';

const publicPaths = ['/authentication/sign-in', '/authentication/sign-up'];

function isPublic(url = '') {
    return publicPaths.some((path) => url.startsWith(path));
}

/** Adds the bearer token and the user language to every request sent to the VitalTrek RESTful API. */
export function iamInterceptor(config) {
    const session = readSession();
    config.headers['Accept-Language'] = i18n.global.locale.value === 'es' ? 'es-419' : 'en-US';
    if (session && !isPublic(config.url)) config.headers.Authorization = `Bearer ${session.token}`;
    return config;
}

/** Ends the session when the API rejects an expired or invalid token. */
export function iamResponseErrorInterceptor(error) {
    if (error.response?.status === 401 && !isPublic(error.config?.url) && readSession()) {
        saveSession(null);
        if (typeof window !== 'undefined') window.location.assign('/sign-in');
    }
    return Promise.reject(error);
}

/** Keeps agency scoping for the json-server Fake API, which cannot read the token. */
export function simulatedApiInterceptor(config) {
    const session = readSession();
    if (session) {
        if (config.method === 'get') config.params = { ...config.params, agencyId: session.user.agencyId };
        if (['post', 'put', 'patch'].includes(config.method) && config.data && typeof config.data === 'object') {
            config.data = { ...config.data, agencyId: session.user.agencyId };
        }
    }
    return config;
}
