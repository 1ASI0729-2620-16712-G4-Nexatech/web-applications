<script setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
const { group, members, checkpoints, segments, prep, iam, execution, sync, safety, refresh } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const checkpointId = ref(null);
const batches = computed(() => sync.batches.filter((b) => b.expeditionGroupId === group.value.id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)));
async function synchronize() {
    await execute(async () => {
        await sync.synchronize(group.value, checkpoints.value.find((c) => c.id === checkpointId.value), checkpoints.value, members.value, prep.preparations);
        execution.revision += 1;
        await execution.load();
        await safety.evaluate(group.value, sync.telemetry, execution.checkIns, segments.value, prep.preparations);
        await refresh();
    }, 'workflow.synced');
}
</script>
<template>
  <div class="vt-stack"><section class="vt-panel"><h2>{{ t('workflow.sync') }}</h2><p>{{ t('workflow.syncDescription') }}</p><WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <p>{{ t('workflow.queuedCount', { count: execution.queue(group).length }) }}</p>
    <form v-if="!iam.isAdmin && group.status === 'active'" class="vt-actions" @submit.prevent="synchronize"><label>{{ t('workflow.checkpoint') }}<select v-model="checkpointId" required><option :value="null" disabled>{{ t('workflow.select') }}</option><option v-for="checkpoint in checkpoints" :key="checkpoint.id" :value="checkpoint.id">{{ checkpoint.location }}</option></select></label><button class="vt-button" :disabled="busy || !execution.queue(group).length">{{ t('workflow.synchronize') }}</button></form>
    <button v-if="group.status === 'active'" class="vt-button secondary" :disabled="busy" @click="execute(() => safety.evaluate(group, sync.telemetry, execution.checkIns, segments, prep.preparations), 'workflow.evaluated')">{{ t('workflow.evaluate') }}</button>
  </section><section class="vt-panel"><h2>{{ t('workflow.syncHistory') }}</h2><p v-if="!batches.length">{{ t('workflow.empty') }}</p><div class="vt-table-wrap"><table v-if="batches.length" class="vt-table"><thead><tr><th>{{ t('workflow.receivedAt') }}</th><th>{{ t('workflow.checkpoint') }}</th><th>{{ t('workflow.records') }}</th><th>{{ t('workflow.duplicates') }}</th><th>{{ t('workflow.state') }}</th></tr></thead><tbody><tr v-for="batch in batches" :key="batch.id"><td>{{ new Date(batch.receivedAt).toLocaleString() }}</td><td>{{ checkpoints.find((c) => c.id === batch.checkpointId)?.location }}</td><td>{{ batch.records.length }}</td><td>{{ batch.duplicates ?? 0 }}</td><td>{{ t(`workflow.status.${batch.status}`) }}</td></tr></tbody></table></div></section></div>
</template>
