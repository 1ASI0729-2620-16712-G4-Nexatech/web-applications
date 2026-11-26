import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { ExpeditionExecutionApi } from '../infrastructure/expedition-execution-api.js';
import { TelemetryRecord } from '../domain/model/telemetry-record.entity.js';
import { createActionState } from '../../shared/application/action-state.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import { appendRecord, queuedRecords } from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';
import useFieldTrackingStore from './field-tracking.store.js';

const api = new ExpeditionExecutionApi();

export default defineStore('execution', () => {
    const iam = useIamStore();
    const tracking = useFieldTrackingStore();
    const revision = ref(0);
    const state = createActionState();
    const checkIns = computed(() => Object.values(tracking.entries).flatMap(({ progress }) =>
        progress?.confirmedCheckpoints.map((checkpoint) => ({
            ...checkpoint,
            expeditionGroupId: progress.expeditionGroupId,
            recordedAt: checkpoint.passedAt,
        })) ?? []));

    function isGuide(group) {
        return iam.user?.role === Roles.GUIDE && Boolean(iam.user.fieldGuideId) && canAccessGroup(iam.user, group);
    }

    function queue(group) {
        void revision.value;
        return queuedRecords(group.agencyId, group.id);
    }

    function sessionFor(group) {
        return tracking.entries[group.id]?.session;
    }

    function canCapture(group) {
        return isGuide(group) && ['scheduled', 'active'].includes(group.status) && sessionFor(group)?.status === 'active';
    }

    function pendingRecords(group) {
        if (!isGuide(group)) return [];
        return queue(group).filter((item) => item.userId === iam.user.id && item.sessionId);
    }

    function pendingArrivals(group) {
        const sessionId = sessionFor(group)?.sessionId;
        // A passage rejected by the server is not an arrival and must not enable the next checkpoint.
        return pendingRecords(group).filter((item) => item.kind === 'check-in' && item.sessionId === sessionId
            && !item.rejection);
    }

    function nextCheckpoint(group, checkpoints) {
        const visited = new Set([
            ...checkIns.value.filter((item) => item.expeditionGroupId === group.id),
            ...pendingArrivals(group),
        ].map((item) => item.checkpointId));
        return checkpoints.find((item) => !visited.has(item.id));
    }

    function start(group) {
        return state.run(async () => {
            requireCondition(isGuide(group), 'workflow.errors.forbidden');
            requireCondition(['scheduled', 'active'].includes(group.status), 'workflow.errors.started');
            const authSession = iam.session;
            const { data } = await api.startTrackingSession(group.id);
            requireCondition(authSession === iam.session && isGuide(group), 'workflow.errors.forbidden');
            requireCondition(data?.expeditionGroupId === group.id && data.agencyId === group.agencyId
                && Number.isInteger(data.id) && data.id > 0 && data.status === 'active', 'workflow.errors.requestFailed');
            tracking.rememberStartedSession(group, data);
            return data;
        });
    }

    function checkIn(group, checkpoint, checkpoints) {
        requireCondition(isGuide(group), 'workflow.errors.forbidden');
        requireCondition(canCapture(group), 'workflow.errors.notActive');
        requireCondition(checkpoint && nextCheckpoint(group, checkpoints)?.id === checkpoint.id, 'workflow.errors.checkpointOrder');
        const clientRecordId = crypto.randomUUID();
        const passedAt = new Date().toISOString();
        appendRecord(group.agencyId, {
            id: clientRecordId,
            clientRecordId,
            kind: 'check-in',
            sessionId: sessionFor(group).sessionId,
            expeditionGroupId: group.id,
            agencyId: group.agencyId,
            fieldGuideId: iam.user.fieldGuideId,
            userId: iam.user.id,
            checkpointId: checkpoint.id,
            passedAt,
            recordedAt: passedAt,
        });
        revision.value += 1;
    }

    function capture(group, member, preparation, values) {
        requireCondition(isGuide(group), 'workflow.errors.forbidden');
        requireCondition(canCapture(group), 'workflow.errors.notActive');
        requireCondition(member?.expeditionGroupId === group.id, 'workflow.errors.invalid');
        requireCondition(preparation?.memberId === member.id && preparation.expeditionGroupId === group.id
            && preparation.ready && !preparation.returnedAt, 'workflow.errors.preparation');
        const record = new TelemetryRecord({
            ...values,
            sessionId: sessionFor(group).sessionId,
            expeditionGroupId: group.id,
            agencyId: group.agencyId,
            fieldGuideId: iam.user.fieldGuideId,
            userId: iam.user.id,
            memberId: member.id,
            wearableDeviceId: preparation.wearableId,
        });
        record.validate();
        appendRecord(group.agencyId, record);
        revision.value += 1;
        return record;
    }

    return {
        checkIns, revision, queue, sessionFor, isGuide, canCapture, pendingRecords, pendingArrivals, nextCheckpoint,
        start, checkIn, capture, pending: state.pending, error: state.error,
    };
});
