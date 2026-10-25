import { ref } from 'vue';
import { defineStore } from 'pinia';
import { ExpeditionExecutionApi } from '../infrastructure/expedition-execution-api.js';
import { TelemetryRecord } from '../domain/model/telemetry-record.entity.js';
import { createActionState } from '../../shared/application/action-state.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import { appendRecord, queuedRecords } from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

const api = new ExpeditionExecutionApi();
export default defineStore('execution', () => {
    const checkIns = ref([]), revision = ref(0);
    const state = createActionState();
    async function load() { checkIns.value = (await api.checkIns.getAll()).data; }
    function queue(group) { void revision.value; return queuedRecords(group.agencyId, group.id); }
    function arrivals(group) {
        return [...checkIns.value.filter((item) => item.expeditionGroupId === group.id), ...queue(group).filter((item) => item.kind === 'check-in')]
            .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
    }
    function assertGuide(group) {
        const iam = useIamStore();
        requireCondition(iam.user?.role === Roles.GUIDE && canAccessGroup(iam.user, group), 'workflow.errors.forbidden');
    }
    async function start(group, members, preparations, route, protocol, segments) {
        return state.run(async () => {
            assertGuide(group);
            requireCondition(group.status === 'scheduled', 'workflow.errors.started');
            requireCondition(route?.status === 'enabled' && protocol && segments.length && segments.every((segment) => segment.expectedTimeWindow), 'workflow.errors.routePreparation');
            requireCondition(members.length && members.every((member) => preparations.find((p) => p.memberId === member.id)?.ready), 'workflow.errors.preparation');
            return (await api.groups.patch(group.id, { status: 'active', startedAt: new Date().toISOString() })).data;
        });
    }
    function checkIn(group, checkpoint, checkpoints) {
        assertGuide(group);
        requireCondition(group.status === 'active', 'workflow.errors.notActive');
        const visited = arrivals(group).map((item) => item.checkpointId);
        const next = checkpoints.find((item) => !visited.includes(item.id));
        requireCondition(next?.id === checkpoint.id, 'workflow.errors.checkpointOrder');
        appendRecord(group.agencyId, { id: crypto.randomUUID(), kind: 'check-in', expeditionGroupId: group.id, checkpointId: checkpoint.id, recordedAt: new Date().toISOString(), agencyId: group.agencyId });
        revision.value += 1;
    }
    function capture(group, member, preparation, values, members) {
        const iam = useIamStore();
        requireCondition(canAccessGroup(iam.user, group, members), 'workflow.errors.forbidden');
        requireCondition(iam.user.role !== Roles.ADMIN && (iam.user.role !== Roles.TOURIST || iam.user.identityDocument === member.identityDocument), 'workflow.errors.forbidden');
        requireCondition(group.status === 'active' && member.expeditionGroupId === group.id, 'workflow.errors.notActive');
        requireCondition(preparation?.ready, 'workflow.errors.preparation');
        const record = new TelemetryRecord({ ...values, expeditionGroupId: group.id, memberId: member.id, wearableId: preparation.wearableId, agencyId: group.agencyId });
        record.validate();
        appendRecord(group.agencyId, record);
        revision.value += 1;
        return record;
    }
    return { checkIns, revision, load, queue, arrivals, start, checkIn, capture, pending: state.pending, error: state.error };
});
