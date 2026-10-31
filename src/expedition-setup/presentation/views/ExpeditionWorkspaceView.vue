<script setup>
import { computed, onMounted, provide, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useSetupStore from '../../application/expedition-setup.store.js';
import usePreparationStore from '../../application/preparation.store.js';
import useExecutionStore from '../../../field-tracking/application/expedition-execution.store.js';
import useSyncStore from '../../../checkpoint-sync/application/checkpoint-sync.store.js';
import useSafetyStore from '../../../safety-monitoring/application/safety-monitoring.store.js';
import useIncidentStore from '../../../incident-response/application/incident-response.store.js';
import useClosureStore from '../../../tour-closure/application/tour-closure.store.js';
import useIamStore from '../../../iam/application/iam.store.js';
import PreparationPanel from '../components/PreparationPanel.vue';
import { ParticipantPreparation } from '../../domain/model/participant-preparation.entity.js';
import TrackingPanel from '../../../field-tracking/presentation/components/TrackingPanel.vue';
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
const { t } = useI18n(), route = useRoute(), tab = ref('preparation'), offline = ref(false);
const { busy, error, execute } = useWorkflow();
const id = Number(route.params.groupId);
const group = computed(() => setup.expeditionGroups.find((g) => g.id === id));
const routeEntity = computed(() => setup.routes.find((r) => r.id === group.value?.routeId));
const members = computed(() => setup.getManifestEntriesByGroupId(id));
const checkpoints = computed(() => setup.getCheckpointsByRouteId(group.value?.routeId));
const segments = computed(() => setup.getRouteSegments(group.value?.routeId));
const protocol = computed(() => prep.protocols.find((p) => p.routeId === group.value?.routeId));
const notes = computed(() => prep.notes.filter((n) => n.routeId === group.value?.routeId));
const key = `vitaltrek-workspace-${iam.user.id}-${id}`;
async function refresh() {
    setup.clearErrors(); safety.clearErrors();
    await Promise.all([setup.fetchRoutes(), setup.fetchExpeditionGroups(), setup.fetchManifestEntries(), setup.fetchCheckpoints(), setup.fetchExpectedTimeWindows(), prep.load(), ...(simulatedOperationsEnabled ? [execution.load(), sync.load(), safety.fetchEarlyWarningAlerts(), incidents.load(), closure.load()] : [])]);
    requireCondition(canAccessGroup(iam.user, group.value), 'workflow.errors.forbidden');
    requireCondition(!setup.errors.length && !safety.errors.length, 'workflow.errors.requestFailed');
    offline.value = false;
    writeLocal(key, { savedAt: new Date().toISOString(), group: group.value, route: routeEntity.value, members: members.value, checkpoints: checkpoints.value, windows: setup.getExpectedTimeWindowsByRouteId(group.value.routeId), preparations: prep.preparations.filter((p) => p.expeditionGroupId === id), notes: notes.value, protocol: protocol.value, arrivals: execution.checkIns.filter((c) => c.expeditionGroupId === id), incidents: incidents.incidents.filter((i) => i.expeditionGroupId === id), summaries: closure.summaries.filter((s) => s.expeditionGroupId === id) });
}
async function load() {
    const result = await execute(refresh, '');
    if (!result) {
        const cached = readLocal(key, null);
        if (cached && canAccessGroup(iam.user, cached.group)) {
            setup.expeditionGroups = [cached.group]; setup.routes = [cached.route]; setup.manifestEntries = cached.members; setup.checkpoints = cached.checkpoints; setup.expectedTimeWindows = cached.windows;
            prep.preparations = cached.preparations.map((p) => new ParticipantPreparation(p)); prep.notes = cached.notes; prep.protocols = cached.protocol ? [cached.protocol] : [];
            execution.checkIns = cached.arrivals; incidents.incidents = cached.incidents; closure.summaries = cached.summaries;
            offline.value = true; error.value = ''; setup.clearErrors(); safety.clearErrors();
        }
    }
}
provide('expedition-workspace', { setup, prep, execution, sync, safety, incidents, closure, iam, group, routeEntity, members, checkpoints, segments, protocol, notes, refresh });
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
      <NextSprintNotice v-else-if="!simulatedOperationsEnabled" />
      <TrackingPanel v-else-if="tab === 'tracking'" />
      <SyncPanel v-else-if="tab === 'sync'" />
      <IncidentPanel v-else-if="tab === 'incidents'" />
      <ClosurePanel v-else />
    </template>
  </section>
</template>
