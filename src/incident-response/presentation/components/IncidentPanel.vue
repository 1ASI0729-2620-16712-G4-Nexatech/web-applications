<script setup>
import { computed, inject, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import { requireCondition } from '../../../shared/domain/application-error.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
const { group, iam, safety, incidents, protocol } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const form = reactive({ description: '', severity: 'medium', alertId: null });
const action = reactive({ incidentId: null, note: '', recipient: '', channel: 'sms', organization: '', phone: '', location: '' });
const alerts = computed(() => safety.getEarlyWarningAlertsByGroupId(group.value.id));
const cases = computed(() => incidents.incidents.filter((i) => i.expeditionGroupId === group.value.id));
const selected = computed(() => cases.value.find((i) => i.id === action.incidentId));
async function declare() {
    const result = await execute(async () => {
        const incident = await incidents.declare(group.value, form.description, form.severity, alerts.value.find((a) => a.id === form.alertId));
        action.incidentId = incident.id;
    });
    if (result) Object.assign(form, { description: '', alertId: null });
}
async function alertAction(callback) { await execute(async () => { requireCondition(await callback(), 'workflow.errors.transition'); }); }
</script>
<template>
  <div class="vt-stack"><WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <section class="vt-panel"><h2>{{ t('workflow.alerts') }}</h2><p class="vt-preserve">{{ protocol?.instructions }}</p><p v-if="!alerts.length">{{ t('workflow.empty') }}</p>
      <article v-for="alert in alerts" :key="alert.id" class="vt-case"><div class="vt-page-header"><h3>{{ t(`earlyWarningAlerts.type.${alert.type}`) }}</h3><span class="vt-badge">{{ t(`earlyWarningAlerts.priority.${alert.priority}`) }} · {{ t(`earlyWarningAlerts.status.${alert.status}`) }}</span></div><ul><li v-for="(evidence, index) in alert.riskEvidence" :key="index">{{ evidence.observedValue }} / {{ evidence.expectedValue }} · {{ t('workflow.recordedAt') }}: {{ new Date(evidence.recordedAt).toLocaleString() }}</li></ul><div v-if="safety.isAlertActionable(alert.status)" class="vt-actions"><button class="vt-button secondary" :disabled="busy || alert.status === 'acknowledged'" @click="alertAction(() => safety.acknowledgeAlert(alert.id))">{{ t('workflow.acknowledge') }}</button><button class="vt-button secondary" :disabled="busy" @click="alertAction(() => safety.dismissAlertAsFalseAlarm(alert.id))">{{ t('workflow.falseAlarm') }}</button><button class="vt-button secondary" :disabled="busy" @click="alertAction(() => safety.resolveAlert(alert.id))">{{ t('workflow.resolve') }}</button><button v-if="group.status === 'active'" class="vt-button" :disabled="busy" @click="form.alertId = alert.id; form.description = t(`earlyWarningAlerts.type.${alert.type}`)">{{ t('workflow.linkIncident') }}</button></div></article>
    </section>
    <div class="vt-grid"><section class="vt-panel"><h2>{{ t('workflow.reportIncident') }}</h2><form v-if="group.status === 'active'" class="vt-form" @submit.prevent="declare"><label>{{ t('workflow.description') }}<textarea v-model="form.description" required maxlength="3000" rows="3" /></label><label>{{ t('workflow.severity') }}<select v-model="form.severity"><option v-for="level in ['low', 'medium', 'high', 'critical']" :key="level" :value="level">{{ t(`earlyWarningAlerts.priority.${level}`) }}</option></select></label><p v-if="form.alertId">{{ t('workflow.linkedAlert') }}: {{ form.alertId }} <button type="button" class="vt-link" @click="form.alertId = null">{{ t('workflow.clear') }}</button></p><button class="vt-button" :disabled="busy">{{ t('workflow.reportIncident') }}</button></form><p v-else>{{ t('workflow.trackingReadOnly') }}</p>
      <h3>{{ t('workflow.incidentLog') }}</h3><ul class="vt-list"><li v-for="incident in cases" :key="incident.id"><strong>{{ incident.description }}</strong><span>{{ t(`workflow.status.${incident.status}`) }} · {{ t(`earlyWarningAlerts.priority.${incident.severity}`) }}</span><button class="vt-button secondary" @click="action.incidentId = incident.id">{{ t('workflow.open') }}</button></li></ul><p v-if="!cases.length">{{ t('workflow.empty') }}</p>
    </section>
    <section class="vt-panel"><template v-if="selected"><h2>{{ selected.description }}</h2><p class="vt-badge">{{ t(`workflow.status.${selected.status}`) }}</p><label>{{ t('workflow.actionNote') }}<textarea v-model="action.note" rows="3" maxlength="3000" /></label><div class="vt-actions"><button v-if="selected.status === 'reported'" class="vt-button" :disabled="busy" @click="execute(() => incidents.transition(group, selected, 'confirmed', action.note))">{{ t('workflow.confirmIncident') }}</button><button v-if="iam.isAdmin && selected.status === 'confirmed'" class="vt-button danger" :disabled="busy" @click="execute(() => incidents.transition(group, selected, 'emergency_declared', action.note))">{{ t('workflow.declareEmergency') }}</button><button v-if="selected.status !== 'closed'" class="vt-button secondary" :disabled="busy" @click="execute(() => incidents.transition(group, selected, 'closed', action.note))">{{ t('workflow.closeIncident') }}</button></div>
      <ol class="vt-timeline"><li v-for="(item, index) in selected.evidence" :key="index"><strong>{{ t(`workflow.status.${item.action}`) }}</strong><p>{{ item.note }}</p><small>{{ new Date(item.recordedAt).toLocaleString() }}</small></li></ol>
      <template v-if="selected.status === 'emergency_declared'">
        <form v-if="iam.isAdmin" class="vt-form vt-case" @submit.prevent="execute(() => incidents.notify(group, selected, action.recipient, action.channel))"><h3>{{ t('workflow.notify') }}</h3><p>{{ t('workflow.simulatedNotifications') }}</p><label>{{ t('workflow.recipient') }}<input v-model="action.recipient" required maxlength="200"></label><label>{{ t('workflow.channel') }}<select v-model="action.channel"><option>sms</option><option>email</option><option>phone</option></select></label><button class="vt-button" :disabled="busy">{{ t('workflow.logNotification') }}</button></form>
        <form v-if="iam.isAdmin" class="vt-form vt-case" @submit.prevent="execute(() => incidents.coordinate(group, selected, action.organization, action.phone, action.note))"><h3>{{ t('workflow.rescue') }}</h3><label>{{ t('workflow.organization') }}<input v-model="action.organization" required maxlength="150"></label><label>{{ t('workflow.phone') }}<input v-model="action.phone" required type="tel" maxlength="40"></label><button class="vt-button secondary" :disabled="busy">{{ t('workflow.requestEvacuation') }}</button></form>
        <form class="vt-form vt-case" @submit.prevent="execute(() => incidents.recordEvacuation(group, selected, action.note, action.location), 'workflow.queued')"><h3>{{ t('workflow.evacuation') }}</h3><label>{{ t('workflow.location') }}<input v-model="action.location" required maxlength="200"></label><button class="vt-button secondary" :disabled="busy">{{ t('workflow.recordAction') }}</button></form>
      </template>
      <h3>{{ t('workflow.communicationsLog') }}</h3><ul class="vt-list"><li v-for="item in incidents.notifications.filter((n) => n.incidentId === selected.id)" :key="item.id">{{ item.recipient }} · {{ item.channel }} · {{ t('workflow.simulated') }}</li><li v-for="item in incidents.rescues.filter((r) => r.incidentId === selected.id)" :key="item.id">{{ item.organization }} · {{ item.phone }} · {{ item.note }}</li><li v-for="item in incidents.evacuations.filter((r) => r.incidentId === selected.id)" :key="item.id">{{ item.location }} · {{ item.note }} · {{ new Date(item.recordedAt).toLocaleString() }}</li></ul>
      </template><p v-else>{{ t('workflow.selectIncident') }}</p>
      <p>{{ t('workflow.pendingEvacuations', { count: incidents.outbox().filter((r) => r.expeditionGroupId === group.id).length }) }}</p><button class="vt-button secondary" :disabled="busy" @click="execute(() => incidents.flushEvacuations(group))">{{ t('workflow.syncActions') }}</button>
    </section></div>
  </div>
</template>
