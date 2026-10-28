import { readSession } from './iam-session.js';

export function iamInterceptor(config) {
    const session = readSession();
    if (session && !['/users', '/agencies'].some((path) => config.url.startsWith(path))) {
        config.headers.Authorization = `Bearer ${session.token}`;
        if (config.method === 'get') config.params = { ...config.params, agencyId: session.user.agencyId };
        if (['post', 'put', 'patch'].includes(config.method) && config.data && typeof config.data === 'object') {
            config.data = { ...config.data, agencyId: session.user.agencyId };
        }
    }
    return config;
}
