<script setup>
import { computed, inject, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import TourSummary from './TourSummary.vue';
const { group, routeEntity, prep, closure, incidents, safety, execution, checkpoints, iam, refresh } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const returns = reactive({}), confirmations = reactive({ incidents: false, incomplete: false });
const assigned = computed(() => prep.preparations.filter((p) => p.expeditionGroupId === group.value.id && p.wearableId));
const summary = computed(() => closure.summaries.find((s) => s.expeditionGroupId === group.value.id));
async function finish() {
    await execute(async () => {
        const pending = [...execution.queue(group.value), ...incidents.outbox().filter((r) => r.expeditionGroupId === group.value.id)];
        await closure.finish(group.value, routeEntity.value, prep.preparations, assigned.value.map((p) => ({ wearableId: p.wearableId, condition: returns[p.wearableId] })), incidents.incidents, safety.earlyWarningAlerts, execution.checkIns, checkpoints.value, pending, confirmations);
        await refresh();
    });
}
</script>
<template>
  <div class="vt-stack"><WorkflowFeedback :busy="busy" :error="error" :message="message" /><TourSummary v-if="summary" :summary="summary" />
    <section v-else class="vt-panel"><h2>{{ t('workflow.closure') }}</h2><p>{{ t('workflow.closureDescription') }}</p>
      <p>{{ t('workflow.openIncidentCount', { count: incidents.incidents.filter((i) => i.expeditionGroupId === group.id && i.status !== 'closed').length }) }}</p>
      <p>{{ t('workflow.queuedCount', { count: execution.queue(group).length + incidents.outbox().filter((r) => r.expeditionGroupId === group.id).length }) }}</p>
      <form v-if="!iam.isAdmin && group.status === 'active'" class="vt-form" @submit.prevent="finish"><label v-for="preparation in assigned" :key="preparation.id">{{ prep.wearables.find((w) => w.id === preparation.wearableId)?.code }}<select v-model="returns[preparation.wearableId]" required><option :value="undefined" disabled>{{ t('workflow.select') }}</option><option v-for="condition in ['good', 'maintenance', 'lost']" :key="condition" :value="condition">{{ t(`workflow.${condition}`) }}</option></select></label><label class="vt-check"><input v-model="confirmations.incidents" type="checkbox">{{ t('workflow.confirmOpenIncidents') }}</label><label class="vt-check"><input v-model="confirmations.incomplete" type="checkbox">{{ t('workflow.confirmIncomplete') }}</label><button class="vt-button" :disabled="busy">{{ t('workflow.finish') }}</button></form><p v-else>{{ t('workflow.summaryAfterFinish') }}</p>
    </section>
  </div>
</template>
