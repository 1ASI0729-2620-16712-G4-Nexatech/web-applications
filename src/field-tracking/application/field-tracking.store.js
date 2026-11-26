import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';
import { readLocal, writeLocal } from '../../shared/infrastructure/offline-storage.js';
import { FieldTrackingApi } from '../infrastructure/field-tracking-api.js';
import { GroupProgressAssembler } from '../infrastructure/group-progress.assembler.js';

const api = new FieldTrackingApi();

function cacheKey(actor, group) {
    return `vitaltrek-tracking-v1-${actor.agencyId}-${actor.id}-${actor.fieldGuideId}-${group.id}`;
}

function isAssignedGuide(actor, group) {
    return actor?.role === Roles.GUIDE && Boolean(actor.fieldGuideId) && canAccessGroup(actor, group);
}

function saveGuideSnapshot(actor, group, entry) {
    if (!isAssignedGuide(actor, group)) return;
    // Offline capture needs the confirmed session and passage order, not participant metrics.
    const snapshot = entry?.session?.status === 'active' && {
        session: entry.session,
        progress: entry.progress ? { ...entry.progress, participants: [] } : null,
    };
    try { writeLocal(cacheKey(actor, group), snapshot || null); }
    catch { /* A full local cache must not invalidate a successful server operation. */ }
}

export default defineStore('fieldTracking', () => {
    const iam = useIamStore();
    const entries = ref({});
    const loading = ref({});
    const requests = new Map();

    watch(() => iam.session, () => {
        entries.value = {};
        loading.value = {};
        requests.clear();
    }, { flush: 'sync' });

    function restoreGroupProgress(group) {
        const actor = iam.user;
        const current = entries.value[group.id];
        if (current?.session || current?.progress) {
            entries.value[group.id] = { ...current, state: 'offline' };
        } else if (isAssignedGuide(actor, group) && ['scheduled', 'active'].includes(group.status)) {
            const cached = readLocal(cacheKey(actor, group), null);
            entries.value[group.id] = { ...cached, state: cached ? 'offline' : 'unavailable' };
        } else {
            entries.value[group.id] = { state: 'unavailable' };
        }
    }

    async function readProgress(group, authSession) {
        try {
            const { data } = await api.getGroupProgress(group.id);
            if (iam.session !== authSession) return;
            const progress = GroupProgressAssembler.toEntityFromResource(data, group.id);
            const entry = {
                state: 'ready',
                session: { sessionId: progress.sessionId, status: progress.status },
                progress,
            };
            entries.value[group.id] = entry;
            saveGuideSnapshot(authSession.user, group, entry);
        } catch (error) {
            if (iam.session !== authSession) return;
            const status = error.response?.status;
            if (status === 404 && error.response.data?.code === 'Tracking.ProgressNotFound') {
                entries.value[group.id] = { state: 'empty' };
                saveGuideSnapshot(authSession.user, group, null);
            } else if (!error.response && error.request) {
                restoreGroupProgress(group);
            } else {
                entries.value[group.id] = { state: 'unavailable' };
                if ([401, 403, 404].includes(status)) saveGuideSnapshot(authSession.user, group, null);
            }
        }
    }

    function fetchGroupProgress(group) {
        const authSession = iam.session;
        if (!authSession || group.agencyId !== authSession.user.agencyId) return;
        if (requests.has(group.id)) return requests.get(group.id);
        loading.value[group.id] = true;
        const request = readProgress(group, authSession).finally(() => {
            if (requests.get(group.id) !== request) return;
            requests.delete(group.id);
            delete loading.value[group.id];
        });
        requests.set(group.id, request);
        return request;
    }

    function rememberStartedSession(group, session) {
        const current = entries.value[group.id];
        const entry = {
            state: 'ready',
            session: { sessionId: session.id, status: session.status },
            progress: current?.progress?.sessionId === session.id ? current.progress : null,
        };
        entries.value[group.id] = entry;
        saveGuideSnapshot(iam.user, group, entry);
    }

    return { entries, loading, fetchGroupProgress, restoreGroupProgress, rememberStartedSession };
});
