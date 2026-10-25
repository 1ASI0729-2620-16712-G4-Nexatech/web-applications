import useIamStore from '../application/iam.store.js';
import { homeForRole, canAccessGroup } from '../domain/user.entity.js';
import { readSession } from './iam-session.js';
import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { readLocal } from '../../shared/infrastructure/offline-storage.js';

export async function authenticationGuard(to) {
    const iam = useIamStore();
    if (!readSession()) iam.signOut();
    if (to.meta.public) return to.name === 'iam-sign-in' && iam.isSignedIn ? homeForRole(iam.user.role) : true;
    if (!iam.isSignedIn) return { name: 'iam-sign-in' };
    if (to.meta.roles && !to.meta.roles.includes(iam.user.role)) return homeForRole(iam.user.role);
    if (!to.params.groupId && !to.params.routeId) return true;
    try {
        const api = new BaseApi();
        if (to.params.groupId) {
            const group = (await api.http.get(`/expedition-groups/${to.params.groupId}`)).data;
            if (!canAccessGroup(iam.user, group)) return { name: 'forbidden' };
        }
        if (to.params.routeId) {
            const route = (await api.http.get(`/routes/${to.params.routeId}`)).data;
            if (route.agencyId !== iam.user.agencyId) return { name: 'forbidden' };
        }
        return true;
    } catch (error) {
        if (!error.response && to.params.groupId) {
            const snapshot = readLocal(`vitaltrek-workspace-${iam.user.id}-${to.params.groupId}`, null);
            if (snapshot && canAccessGroup(iam.user, snapshot.group)) return true;
        }
        return error.response?.status === 404 ? { name: 'not-found' } : { name: 'connection-error', query: { retry: to.fullPath } };
    }
}
