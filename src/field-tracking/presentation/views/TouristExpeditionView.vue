<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../../iam/application/iam.store.js';
import useSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import usePreparationStore from '../../../expedition-setup/application/preparation.store.js';
import useExecutionStore from '../../application/expedition-execution.store.js';
import useClosureStore from '../../../tour-closure/application/tour-closure.store.js';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import { readLocal, writeLocal } from '../../../shared/infrastructure/offline-storage.js';
import { requireCondition } from '../../../shared/domain/application-error.js';
import { ParticipantPreparation } from '../../../expedition-setup/domain/model/participant-preparation.entity.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import RouteMap from '../../../shared/presentation/components/RouteMap.vue';
import TourSummary from '../../../tour-closure/presentation/components/TourSummary.vue';

const iam = useIamStore(), setup = useSetupStore(), prep = usePreparationStore(), execution = useExecutionStore(), closure = useClosureStore(), { t } = useI18n();
const { busy, error, message, execute } = useWorkflow();
const selectedId = ref(null), online = ref(navigator.onLine), cached = ref(false), downloadedAt = ref('');
const groups = computed(() => setup.expeditionGroups.filter((g) => setup.manifestEntries.some((m) => m.expeditionGroupId === g.id && m.identityDocument === iam.user?.identityDocument)));
const group = computed(() => groups.value.find((g) => g.id === selectedId.value));
const member = computed(() => setup.manifestEntries.find((m) => m.expeditionGroupId === group.value?.id && m.identityDocument === iam.user?.identityDocument));
const participant = computed(() => prep.forMember(member.value?.id));
const route = computed(() => setup.routes.find((r) => r.id === group.value?.routeId));
const checkpoints = computed(() => setup.getCheckpointsByRouteId(group.value?.routeId));
const notes = computed(() => prep.notes.filter((n) => n.routeId === group.value?.routeId));
const summary = computed(() => closure.summaries.find((s) => s.expeditionGroupId === group.value?.id));
const form = reactive({ name: '', phone: '', relationship: '', consent: false, activated: false });
const telemetry = reactive({ heartRate: 80, battery: 90, deviationMeters: 0 });
const cacheKey = `vitaltrek-tourist-v1-${iam.user.id}`;
watch([selectedId, participant], () => {
    const current = participant.value;
    Object.assign(form, { name: current?.emergencyContact?.name ?? '', phone: current?.emergencyContact?.phone ?? '', relationship: current?.emergencyContact?.relationship ?? '', consent: current?.consent ?? false, activated: current?.activated ?? false });
});
async function load() {
    setup.clearErrors();
    const result = await execute(async () => {
        await Promise.all([setup.fetchRoutes(), setup.fetchExpeditionGroups(), setup.fetchManifestEntries(), setup.fetchCheckpoints(), prep.load(), closure.load()]);
        requireCondition(!setup.errors.length, 'workflow.errors.requestFailed');
        cached.value = false;
        if (!groups.value.some((g) => g.id === selectedId.value)) selectedId.value = groups.value[0]?.id ?? null;
    }, '');
    if (!result) {
        const snapshot = readLocal(cacheKey, null);
        if (snapshot && snapshot.userId === iam.user.id && snapshot.agencyId === iam.user.agencyId) {
            setup.expeditionGroups = snapshot.groups; setup.routes = snapshot.routes; setup.manifestEntries = snapshot.members; setup.checkpoints = snapshot.checkpoints;
            prep.preparations = snapshot.preparations.map((p) => new ParticipantPreparation(p)); prep.notes = snapshot.notes; closure.summaries = snapshot.summaries;
            selectedId.value = groups.value[0]?.id ?? null; cached.value = true; downloadedAt.value = snapshot.savedAt; error.value = ''; setup.clearErrors();
        }
    }
}
function download() {
    requireCondition(groups.value.length, 'workflow.errors.invalid');
    const groupIds = groups.value.map((g) => g.id), routeIds = groups.value.map((g) => g.routeId);
    const members = setup.manifestEntries.filter((m) => m.identityDocument === iam.user.identityDocument && groupIds.includes(m.expeditionGroupId));
    const snapshot = { userId: iam.user.id, agencyId: iam.user.agencyId, savedAt: new Date().toISOString(), groups: groups.value, routes: setup.routes.filter((r) => routeIds.includes(r.id)), members, checkpoints: setup.checkpoints.filter((c) => routeIds.includes(c.routeId)), notes: prep.notes.filter((n) => routeIds.includes(n.routeId)), preparations: prep.preparations.filter((p) => members.some((m) => m.id === p.memberId)), summaries: closure.summaries.filter((s) => groupIds.includes(s.expeditionGroupId)) };
    writeLocal(cacheKey, snapshot); downloadedAt.value = snapshot.savedAt;
}
async function save() {
    await execute(async () => {
        await prep.saveParticipant(group.value, member.value, { consent: form.consent, activated: form.activated, emergencyContact: { name: form.name, phone: form.phone, relationship: form.relationship } }, [member.value]);
        if (downloadedAt.value) download();
    });
}
function capture() {
    return execute(() => execution.capture(group.value, member.value, participant.value, { ...telemetry, latitude: checkpoints.value[0]?.latitude ?? -9.5, longitude: checkpoints.value[0]?.longitude ?? -77.5 }, [member.value]), 'workflow.queued');
}
function updateConnection() { online.value = navigator.onLine; }
onMounted(() => { downloadedAt.value = readLocal(cacheKey, null)?.savedAt ?? ''; load(); window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); });
onUnmounted(() => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection); });
</script>
<template>
  <section class="vt-page"><header class="vt-page-header"><div><p class="vt-eyebrow">{{ t('auth.tourist') }}</p><h1>{{ t('tourist.title') }}, {{ iam.user?.name }}</h1><p>{{ t('tourist.description') }}</p></div><span class="vt-badge">{{ t(online ? 'workflow.online' : 'workflow.offline') }}</span></header>
    <WorkflowFeedback :busy="busy" :error="error" :message="message" /><p v-if="cached" class="vt-notice">{{ t('workflow.cached') }}</p>
    <div class="vt-actions"><label>{{ t('workflow.expeditions') }}<select v-model="selectedId"><option v-for="item in groups" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><button class="vt-button secondary" :disabled="busy" @click="load">{{ t('workflow.refresh') }}</button><button class="vt-button" :disabled="busy || !group" @click="execute(download, 'tourist.downloaded')">{{ t('tourist.download') }}</button></div>
    <p v-if="downloadedAt" class="vt-muted">{{ t('tourist.savedAt') }}: {{ new Date(downloadedAt).toLocaleString() }}</p>
    <p v-if="!busy && !groups.length" class="vt-notice">{{ t('tourist.noExpedition') }}</p>
    <template v-if="group"><div class="vt-grid"><section class="vt-panel"><span class="vt-badge">{{ t(`workflow.status.${group.status}`) }}</span><h2>{{ route?.name }}</h2><p>{{ route?.origin }} → {{ route?.destination }}</p><RouteMap :checkpoints="checkpoints" /><ol class="vt-timeline"><li v-for="checkpoint in checkpoints" :key="checkpoint.id"><strong>{{ checkpoint.location }}</strong><small>{{ checkpoint.latitude }}, {{ checkpoint.longitude }}</small></li></ol><h3>{{ t('workflow.notes') }}</h3><p v-for="note in notes" :key="note.id" class="vt-preserve">{{ note.content }}</p></section>
      <section class="vt-panel"><h2>{{ t('tourist.preparation') }}</h2><p>{{ t('tourist.consentExplanation') }}</p><form v-if="group.status !== 'finished'" class="vt-form" @submit.prevent="save"><label>{{ t('tourist.contactName') }}<input v-model="form.name" required maxlength="100"></label><label>{{ t('workflow.phone') }}<input v-model="form.phone" type="tel" required maxlength="40"></label><label>{{ t('tourist.relationship') }}<input v-model="form.relationship" maxlength="80"></label><label class="vt-check"><input v-model="form.consent" type="checkbox" required>{{ t('tourist.consent') }}</label><label class="vt-check"><input v-model="form.activated" type="checkbox" :disabled="!participant?.wearableId">{{ t('tourist.activate') }}</label><p v-if="!participant?.wearableId" class="vt-muted">{{ t('tourist.waitWearable') }}</p><button class="vt-button" :disabled="busy || cached">{{ t('workflow.save') }}</button></form>
        <template v-if="group.status === 'active'"><h3>{{ t('workflow.telemetry') }}</h3><p>{{ t('workflow.telemetryDescription') }}</p><form class="vt-form" @submit.prevent="capture"><label>{{ t('workflow.heartRate') }}<input v-model.number="telemetry.heartRate" type="number" required min="1" max="300"></label><label>{{ t('workflow.battery') }}<input v-model.number="telemetry.battery" type="number" required min="0" max="100"></label><label>{{ t('workflow.deviation') }}<input v-model.number="telemetry.deviationMeters" type="number" required min="0"></label><button class="vt-button secondary" :disabled="busy || !participant?.ready">{{ t('workflow.capture') }}</button></form></template>
      </section></div><TourSummary v-if="summary" :summary="summary" /><p v-else class="vt-notice">{{ t('workflow.summaryAfterFinish') }}</p></template>
  </section>
</template>
