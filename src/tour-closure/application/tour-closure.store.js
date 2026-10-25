import { ref } from 'vue';
import { defineStore } from 'pinia';
import { TourClosure } from '../domain/model/tour-closure.entity.js';
import { TourClosureApi } from '../infrastructure/tour-closure-api.js';
import { TourSummaryAssembler } from '../infrastructure/tour-summary.assembler.js';
import { createActionState } from '../../shared/application/action-state.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

const api = new TourClosureApi();
export default defineStore('tourClosure', () => {
    const summaries = ref([]);
    const state = createActionState();
    async function load() { summaries.value = TourSummaryAssembler.toEntitiesFromResponse(await api.summaries.getAll()); }
    async function finish(group, route, preparations, returns, incidents, alerts, checkIns, checkpoints, pendingRecords, confirmations) {
        return state.run(async () => {
            const iam = useIamStore();
            requireCondition(iam.user?.role === Roles.GUIDE && canAccessGroup(iam.user, group), 'workflow.errors.forbidden');
            const closure = new TourClosure({ id: group.id, expeditionGroupId: group.id, returns });
            const groupIncidents = incidents.filter((i) => i.expeditionGroupId === group.id);
            closure.validate(group, preparations, returns, groupIncidents.filter((i) => i.status !== 'closed'), pendingRecords, confirmations);
            const existing = (await api.closures.getAll({ id: group.id })).data[0];
            if (existing) await api.closures.patch(group.id, closure); else await api.closures.create(closure);
            const finishedAt = new Date().toISOString();
            for (const item of returns) {
                const preparation = preparations.find((p) => p.expeditionGroupId === group.id && p.wearableId === item.wearableId);
                requireCondition(preparation, 'workflow.errors.returns');
                await api.wearables.patch(item.wearableId, { status: item.condition === 'good' ? 'available' : item.condition });
                await api.preparations.patch(preparation.id, { returnedAt: finishedAt, returnCondition: item.condition, activated: false });
            }
            const visits = checkIns.filter((c) => c.expeditionGroupId === group.id);
            const summary = { id: group.id, expeditionGroupId: group.id, groupName: group.name, routeName: route.name, distanceKm: route.distanceKm, startedAt: group.startedAt, finishedAt, durationMinutes: Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(group.startedAt)) / 60000)), checkpoints: checkpoints.filter((c) => visits.some((v) => v.checkpointId === c.id)).map((c) => ({ id: c.id, location: c.location })), totalCheckpoints: checkpoints.length, alertCount: alerts.filter((a) => a.expeditionGroupId === group.id).length, incidentCount: groupIncidents.length, openIncidentCount: groupIncidents.filter((i) => i.status !== 'closed').length, incomplete: !!pendingRecords.length, pendingRecordCount: pendingRecords.length };
            if ((await api.summaries.getAll({ id: group.id })).data.length) await api.summaries.patch(group.id, summary); else await api.summaries.create(summary);
            await api.groups.patch(group.id, { status: 'finished', finishedAt });
            await api.closures.patch(group.id, { status: 'completed', finishedAt });
            await load();
            return summary;
        });
    }
    return { summaries, load, finish, pending: state.pending, error: state.error };
});
