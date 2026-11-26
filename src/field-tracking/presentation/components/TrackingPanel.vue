<script setup>
import { computed, inject, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import RouteMap from '../../../shared/presentation/components/RouteMap.vue';
import TrackingProgressSummary from './TrackingProgressSummary.vue';
import TrackingReadings from './TrackingReadings.vue';

const { group, members, checkpoints, execution, prep, tracking } = inject('expedition-workspace');
const { t } = useI18n();
const { busy, error, message, execute } = useWorkflow();
const entry = computed(() => tracking.entries[group.value.id]);
const canCapture = computed(() => execution.canCapture(group.value));
const confirmed = computed(() => new Set(entry.value?.progress?.confirmedCheckpoints.map((item) => item.checkpointId)));
const pending = computed(() => new Set(execution.pendingArrivals(group.value).map((item) => item.checkpointId)));
const nextCheckpoint = computed(() => execution.nextCheckpoint(group.value, checkpoints.value));
const readyMembers = computed(() => members.value.filter((member) => {
    const preparation = prep.forMember(member.id);
    return preparation?.ready && !preparation.returnedAt;
}));
const values = reactive({
    memberId: readyMembers.value[0]?.id ?? null,
    heartRate: 80,
    battery: 90,
    latitude: checkpoints.value[0]?.latitude ?? -9.5,
    longitude: checkpoints.value[0]?.longitude ?? -77.5,
    altitude: '',
    deviationMeters: 0,
});

function capture() {
    const member = readyMembers.value.find((item) => item.id === values.memberId);
    return execute(() => execution.capture(group.value, member, prep.forMember(member?.id), values), 'workflow.queued');
}

function checkIn(checkpoint) {
    return execute(() => execution.checkIn(group.value, checkpoint, checkpoints.value), 'workflow.queued');
}
</script>

<template>
  <div class="vt-grid">
    <section class="vt-panel">
      <h2>{{ t('workflow.tracking') }}</h2>
      <TrackingProgressSummary :entry="entry" :loading="Boolean(tracking.loading[group.id])" />
      <RouteMap :checkpoints="checkpoints" />
      <ol class="vt-timeline">
        <li v-for="checkpoint in checkpoints" :key="checkpoint.id">
          <strong>{{ checkpoint.location }}</strong>
          <small>{{ checkpoint.latitude }}, {{ checkpoint.longitude }}</small>
          <span v-if="confirmed.has(checkpoint.id)" class="vt-badge">{{ t('groupProgress.confirmed') }}</span>
          <span v-else-if="pending.has(checkpoint.id)" class="vt-badge">{{ t('workflow.reached') }}</span>
          <span v-else class="vt-badge">{{ t('workflow.pending') }}</span>
          <button v-if="canCapture && nextCheckpoint?.id === checkpoint.id" class="vt-button secondary"
                  :disabled="busy" @click="checkIn(checkpoint)">{{ t('workflow.checkIn') }}</button>
        </li>
      </ol>
    </section>

    <section class="vt-panel">
      <h2>{{ t('groupProgress.latestReadings') }}</h2>
      <TrackingReadings v-if="entry?.progress" :readings="entry.progress.participants" :members="members" />
      <WorkflowFeedback :busy="busy" :error="error" :message="message" />
      <template v-if="canCapture">
        <h3>{{ t('workflow.telemetry') }}</h3>
        <p>{{ t('workflow.telemetryDescription') }}</p>
        <p>{{ t('workflow.queuedCount', { count: execution.pendingRecords(group).length }) }}</p>
        <form v-if="readyMembers.length" class="vt-form" @submit.prevent="capture">
          <label>{{ t('workflow.participant') }}
            <select v-model="values.memberId" required>
              <option :value="null" disabled>{{ t('workflow.select') }}</option>
              <option v-for="member in readyMembers" :key="member.id" :value="member.id">{{ member.fullName }}</option>
            </select>
          </label>
          <label>{{ t('workflow.heartRate') }}<input v-model.number="values.heartRate" type="number" required min="1" max="300"></label>
          <label>{{ t('workflow.battery') }}<input v-model.number="values.battery" type="number" required min="0" max="100"></label>
          <label>{{ t('workflow.latitude') }}<input v-model.number="values.latitude" type="number" required min="-90" max="90" step="any"></label>
          <label>{{ t('workflow.longitude') }}<input v-model.number="values.longitude" type="number" required min="-180" max="180" step="any"></label>
          <label>{{ t('groupProgress.altitude') }} (m)<input v-model.number="values.altitude" type="number" required step="any"></label>
          <label>{{ t('workflow.deviation') }}<input v-model.number="values.deviationMeters" type="number" required min="0" step="any"></label>
          <button class="vt-button" :disabled="busy">{{ t('workflow.capture') }}</button>
        </form>
        <p v-else class="vt-notice">{{ t('workflow.errors.preparation') }}</p>
      </template>
      <p v-else class="vt-notice">{{ t('workflow.trackingReadOnly') }}</p>
    </section>
  </div>
</template>
