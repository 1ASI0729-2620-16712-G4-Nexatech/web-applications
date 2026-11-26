<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import { SyncBatchAssembler } from '../../infrastructure/sync-batch.assembler.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
const { group, checkpoints, execution, sync, refresh } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const checkpointId = ref(null);
const isGuide = computed(() => execution.isGuide(group.value));
const pendingBatch = computed(() => sync.pendingBatch(group.value));
const history = computed(() => sync.history(group.value));
const rejected = computed(() => sync.rejectedRecords(group.value));
const pendingCount = computed(() => sync.pendingCount(group.value));
const legacyCount = computed(() => sync.legacyCount(group.value));
const lastReceivedAt = computed(() => sync.lastReceivedAt(group.value));
const arrivals = computed(() => sync.syncCheckpoints(group.value, checkpoints.value));
const sessionActive = computed(() => execution.sessionFor(group.value)?.status === 'active');
const canSend = computed(() => isGuide.value && !busy.value && !sync.isSending(group.value)
    && (pendingBatch.value || (sessionActive.value && pendingCount.value > 0
        && arrivals.value.some((checkpoint) => checkpoint.id === checkpointId.value))));
const location = (id) => checkpoints.value.find((checkpoint) => checkpoint.id === id)?.location ?? '—';
const time = (value) => value ? new Date(value).toLocaleString() : '—';
const pendingRecords = (batch) => batch.resource.readings.length + batch.resource.passages.length;
async function synchronize() {
    await execute(async () => {
        await sync.synchronize(group.value, checkpoints.value.find((c) => c.id === checkpointId.value), checkpoints.value);
        execution.revision += 1;
        await refresh();
    }, 'workflow.synced');
    // A failed attempt may still have changed what is pending on this device.
    execution.revision += 1;
}
onMounted(() => {
    sync.prepare(group.value);
    execution.revision += 1;
});
</script>
<template>
  <div class="vt-stack"><section class="vt-panel"><h2>{{ t('workflow.sync') }}</h2><p>{{ t('workflow.syncDescription') }}</p>
    <p><span class="vt-badge">{{ t(sync.online ? 'workflow.online' : 'workflow.offline') }}</span></p>
    <WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <template v-if="isGuide">
      <p>{{ t('workflow.syncPending', { count: pendingCount }) }}</p>
      <p>{{ lastReceivedAt ? t('workflow.syncLastReception', { time: time(lastReceivedAt) }) : t('workflow.syncNoReception') }}</p>
      <p v-if="legacyCount" class="vt-notice" role="status">{{ t('workflow.syncLegacy', { count: legacyCount }) }}</p>
      <p v-if="pendingBatch" class="vt-notice" role="status">{{ t('workflow.syncPendingBatch', { count: pendingRecords(pendingBatch), checkpoint: location(pendingBatch.checkpointId), attempts: pendingBatch.attempts }) }}</p>
      <p v-if="!sessionActive && !pendingBatch" class="vt-notice" role="status">{{ t('workflow.errors.notActive') }}</p>
      <p v-else-if="!pendingBatch && !arrivals.length" class="vt-notice" role="status">{{ t('workflow.errors.checkpointArrival') }}</p>
      <form v-if="pendingBatch || sessionActive" class="vt-actions" @submit.prevent="synchronize">
        <label v-if="!pendingBatch">{{ t('workflow.checkpoint') }}<select v-model="checkpointId" required><option :value="null" disabled>{{ t('workflow.select') }}</option><option v-for="checkpoint in arrivals" :key="checkpoint.id" :value="checkpoint.id">{{ checkpoint.location }}</option></select></label>
        <button class="vt-button" :disabled="!canSend">{{ t(pendingBatch ? 'workflow.syncRetry' : 'workflow.synchronize') }}</button>
      </form>
    </template>
  </section>
  <section v-if="isGuide && rejected.length" class="vt-panel"><h2>{{ t('workflow.syncRejected') }}</h2><p>{{ t('workflow.syncRejectedHelp') }}</p>
    <div class="vt-table-wrap"><table class="vt-table"><thead><tr><th>{{ t('workflow.kind') }}</th><th>{{ t('workflow.capturedAt') }}</th><th>{{ t('workflow.reason') }}</th><th></th></tr></thead><tbody>
      <tr v-for="record in rejected" :key="record.id"><td>{{ t(`workflow.kinds.${record.kind}`) }}</td><td>{{ time(record.recordedAt) }}</td><td>{{ t(SyncBatchAssembler.toMessageKey(record.rejection.code)) }}</td><td><button class="vt-button secondary" :disabled="busy" @click="sync.discardRejected(group, record.id); execution.revision += 1">{{ t('workflow.discard') }}</button></td></tr>
    </tbody></table></div>
  </section>
  <section class="vt-panel"><h2>{{ t('workflow.syncHistory') }}</h2><p v-if="!history.length">{{ t('workflow.empty') }}</p><div class="vt-table-wrap"><table v-if="history.length" class="vt-table"><thead><tr><th>{{ t('workflow.receivedAt') }}</th><th>{{ t('workflow.checkpoint') }}</th><th>{{ t('workflow.accepted') }}</th><th>{{ t('workflow.duplicates') }}</th><th>{{ t('workflow.rejected') }}</th><th>{{ t('workflow.evaluationStatus') }}</th><th></th></tr></thead><tbody>
    <tr v-for="batch in history" :key="batch.batchId"><td>{{ time(batch.receivedAt) }}</td><td>{{ location(batch.checkpointId) }}</td><td>{{ batch.acceptedRecordIds.length }}</td><td>{{ batch.duplicateRecordIds.length }}</td><td>{{ batch.rejectedRecords.length }}</td><td>{{ t(`workflow.evaluation.${batch.evaluationStatus}`) }}</td><td><button class="vt-button secondary" :disabled="busy" @click="execute(() => sync.refreshBatch(group, batch.batchId), '')">{{ t('workflow.refreshBatch') }}</button></td></tr>
  </tbody></table></div></section></div>
</template>
