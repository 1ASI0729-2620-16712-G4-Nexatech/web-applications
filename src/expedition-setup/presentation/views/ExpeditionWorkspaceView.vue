<script setup>
import { computed, onMounted, provide, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useSetupStore from '../../application/expedition-setup.store.js';
import usePreparationStore from '../../application/preparation.store.js';
import useExecutionStore from '../../../field-tracking/application/expedition-execution.store.js';
import useFieldTrackingStore from '../../../field-tracking/application/field-tracking.store.js';
import useSyncStore from '../../../checkpoint-sync/application/checkpoint-sync.store.js';
import useSafetyStore from '../../../safety-monitoring/application/safety-monitoring.store.js';
import useIncidentStore from '../../../incident-response/application/incident-response.store.js';
import useClosureStore from '../../../tour-closure/application/tour-closure.store.js';
import useIamStore from '../../../iam/application/iam.store.js';
import PreparationPanel from '../components/PreparationPanel.vue';
import { ParticipantPreparation } from '../../domain/model/participant-preparation.entity.js';
import TrackingPanel from '../../../field-tracking/presentation/components/TrackingPanel.vue';
import GroupAlertsPanel from '../../../safety-monitoring/presentation/components/GroupAlertsPanel.vue';
import SyncPanel from '../../../checkpoint-sync/presentation/components/SyncPanel.vue';
import IncidentPanel from '../../../incident-response/presentation/components/IncidentPanel.vue';
import ClosurePanel from '../../../tour-closure/presentation/components/ClosurePanel.vue';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import { readLocal, writeLocal } from '../../../shared/infrastructure/offline-storage.js';
import { requireCondition } from '../../../shared/domain/application-error.js';
import { canAccessGroup } from '../../../iam/domain/user.entity.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import NextSprintNotice from '../../../shared/presentation/components/NextSprintNotice.vue';
import { simulatedOperationsEnabled } from '../../../shared/infrastructure/simulated-operations.js';

const setup = useSetupStore(), prep = usePreparationStore(), execution = useExecutionStore(), sync = useSyncStore(), safety = useSafetyStore(), incidents = useIncidentStore(), closure = useClosureStore(), iam = useIamStore();
const tracking = useFieldTrackingStore();
const { t } = useI18n(), route = useRoute(), tab = ref('preparation'), offline = ref(false);
const { busy, error, execute } = useWorkflow();
const id = Number(route.params.groupId);
const group = computed(() => setup.expeditionGroups.find((item) => item.id === id && canAccessGroup(iam.user, item)));
const hasTracking = computed(() => group.value && (
    ['active', 'finished'].includes(group.value.status) || execution.sessionFor(group.value)
    || execution.queue(group.value).some((record) => record.sessionId)
));
const routeEntity = computed(() => setup.routes.find((r) => r.id === group.value?.routeId));
const members = computed(() => setup.getManifestEntriesByGroupId(id));
const checkpoints = computed(() => setup.getCheckpointsByRouteId(group.value?.routeId));
const segments = computed(() => setup.getRouteSegments(group.value?.routeId));
const protocol = computed(() => prep.protocols.find((p) => p.routeId === group.value?.routeId));
const notes = computed(() => prep.notes.filter((n) => n.routeId === group.value?.routeId));
const trackingSession = computed(() => tracking.entries[id]?.session ?? null);
const key = `vitaltrek-workspace-${iam.user.id}-${id}`;
async function refresh() {
    setup.clearErrors();
    safety.clearErrors();
    const simulatedLoad = simulatedOperationsEnabled
        ? Promise.allSettled([sync.load(), incidents.load(), closure.load()])
        : null;
    await Promise.all([
        setup.fetchRoutes(), setup.fetchExpeditionGroups(), setup.fetchManifestEntries(),
        setup.fetchCheckpoints(), setup.fetchExpectedTimeWindows(), prep.load(),
    ]);
    requireCondition(!setup.errors.length, 'workflow.errors.requestFailed');
    requireCondition(group.value, 'workflow.errors.forbidden');
    if (hasTracking.value) await tracking.fetchGroupProgress(group.value);
    if (trackingSession.value?.sessionId) await safety.fetchAlertsForSession(trackingSession.value.sessionId);
    await simulatedLoad;
    offline.value = false;
    writeLocal(key, { savedAt: new Date().toISOString(), group: group.value, route: routeEntity.value, members: members.value, checkpoints: checkpoints.value, windows: setup.getExpectedTimeWindowsByRouteId(group.value.routeId), preparations: prep.preparations.filter((p) => p.expeditionGroupId === id), notes: notes.value, protocol: protocol.value, incidents: incidents.incidents.filter((i) => i.expeditionGroupId === id), summaries: closure.summaries.filter((s) => s.expeditionGroupId === id) });
}
async function load() {
    const result = await execute(refresh, '');
    if (!result && !['workflow.errors.forbidden', 'workflow.errors.sessionExpired'].includes(error.value)) {
        const cached = readLocal(key, null);
        if (cached && canAccessGroup(iam.user, cached.group)) {
            setup.expeditionGroups = [cached.group]; setup.routes = [cached.route]; setup.manifestEntries = cached.members; setup.checkpoints = cached.checkpoints; setup.expectedTimeWindows = cached.windows;
            prep.preparations = cached.preparations.map((p) => new ParticipantPreparation(p)); prep.notes = cached.notes; prep.protocols = cached.protocol ? [cached.protocol] : [];
            tracking.restoreGroupProgress(cached.group);
            incidents.incidents = cached.incidents; closure.summaries = cached.summaries;
            offline.value = true; error.value = ''; setup.clearErrors(); safety.clearErrors();
        }
    }
}
async function showTracking() {
    tab.value = 'tracking';
    await load();
}

provide('expedition-workspace', {
    setup, prep, execution, tracking, sync, safety, incidents, closure, iam, group, routeEntity,
    members, checkpoints, segments, protocol, notes, refresh, showTracking,
});
onMounted(load);
</script>
<template>
  <section class="vt-page">
    <RouterLink :to="iam.isAdmin ? '/operations/expeditions' : '/field-guide/groups'">← {{ t('workflow.expeditions') }}</RouterLink>
    <header v-if="group" class="vt-page-header"><div><p class="vt-eyebrow">{{ routeEntity?.name }}</p><h1>{{ group.name }}</h1><p>{{ t(`workflow.status.${group.status}`) }} · {{ group.departureDate }}</p></div><button class="vt-button secondary" :disabled="busy" @click="load">{{ t('workflow.refresh') }}</button></header>
    <WorkflowFeedback :busy="busy" :error="error" />
    <p v-if="offline" class="vt-notice" role="status">{{ t('workflow.cached') }}</p>
    <template v-if="group && !busy">
      <nav class="vt-tabs" :aria-label="t('workflow.expeditionSections')"><button v-for="item in ['preparation', 'tracking', 'sync', 'incidents', 'closure']" :key="item" :class="{ active: tab === item }" :aria-current="tab === item ? 'page' : undefined" @click="tab = item">{{ t(`workflow.${item}`) }}</button></nav>
      <PreparationPanel v-if="tab === 'preparation'" />
      <template v-else-if="tab === 'tracking'">
        <TrackingPanel />
        <GroupAlertsPanel :group="group" :members="members" :session-id="trackingSession?.sessionId ?? null"
                          :session-active="trackingSession?.status === 'active'" />
      </template>
      <SyncPanel v-else-if="tab === 'sync' && hasTracking" />
      <NextSprintNotice v-else-if="!simulatedOperationsEnabled" />
      <SyncPanel v-else-if="tab === 'sync'" />
      <IncidentPanel v-else-if="tab === 'incidents'" />
      <ClosurePanel v-else />
    </template>
  </section>
</template>
