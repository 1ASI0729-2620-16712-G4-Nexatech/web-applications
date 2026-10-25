<script setup>
import { inject, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import RouteMap from '../../../shared/presentation/components/RouteMap.vue';
const { group, members, checkpoints, execution, prep, iam } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const values = reactive({ memberId: members.value[0]?.id, heartRate: 80, battery: 90, latitude: checkpoints.value[0]?.latitude ?? -9.5, longitude: checkpoints.value[0]?.longitude ?? -77.5, deviationMeters: 0 });
const visited = computed(() => execution.arrivals(group.value));
const queueCount = computed(() => execution.queue(group.value).length);
async function capture() { await execute(() => { const member = members.value.find((m) => m.id === values.memberId); return execution.capture(group.value, member, prep.forMember(member.id), values, members.value); }, 'workflow.queued'); }
</script>
<template>
  <div class="vt-grid"><section class="vt-panel"><h2>{{ t('workflow.tracking') }}</h2><p>{{ t('workflow.trackingDescription') }}</p><RouteMap :checkpoints="checkpoints" /><ol class="vt-timeline"><li v-for="checkpoint in checkpoints" :key="checkpoint.id"><strong>{{ checkpoint.location }}</strong><small>{{ checkpoint.latitude }}, {{ checkpoint.longitude }}</small><span class="vt-badge">{{ t(visited.some((c) => c.checkpointId === checkpoint.id) ? 'workflow.reached' : 'workflow.pending') }}</span><button v-if="!iam.isAdmin && group.status === 'active'" class="vt-button secondary" :disabled="busy || visited.some((c) => c.checkpointId === checkpoint.id)" @click="execute(() => execution.checkIn(group, checkpoint, checkpoints), 'workflow.queued')">{{ t('workflow.checkIn') }}</button></li></ol></section>
    <section class="vt-panel"><h2>{{ t('workflow.telemetry') }}</h2><p>{{ t('workflow.telemetryDescription') }}</p><p>{{ t('workflow.queuedCount', { count: queueCount }) }}</p><WorkflowFeedback :busy="busy" :error="error" :message="message" />
      <form v-if="!iam.isAdmin && group.status === 'active'" class="vt-form" @submit.prevent="capture"><label>{{ t('workflow.participant') }}<select v-model="values.memberId" required><option v-for="member in members" :key="member.id" :value="member.id">{{ member.fullName }}</option></select></label><label>{{ t('workflow.heartRate') }}<input v-model.number="values.heartRate" type="number" required min="1" max="300"></label><label>{{ t('workflow.battery') }}<input v-model.number="values.battery" type="number" required min="0" max="100"></label><label>{{ t('workflow.latitude') }}<input v-model.number="values.latitude" type="number" required min="-90" max="90" step="any"></label><label>{{ t('workflow.longitude') }}<input v-model.number="values.longitude" type="number" required min="-180" max="180" step="any"></label><label>{{ t('workflow.deviation') }}<input v-model.number="values.deviationMeters" type="number" required min="0"></label><button class="vt-button" :disabled="busy">{{ t('workflow.capture') }}</button></form>
      <p v-else class="vt-notice">{{ t('workflow.trackingReadOnly') }}</p>
    </section>
  </div>
</template>
