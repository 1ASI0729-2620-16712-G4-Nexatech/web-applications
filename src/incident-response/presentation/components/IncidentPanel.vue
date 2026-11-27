<script setup>
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import { useAlertTime } from '../../../safety-monitoring/presentation/use-alert-time.js';
import { Roles } from '../../../iam/domain/user.entity.js';
import { EvacuationStatuses, IncidentSeverities, IncidentTypes } from '../../domain/model/incident.entity.js';

const { group, iam, safety, incidents, tracking, protocol } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const { timestamp, age } = useAlertTime();

const session = computed(() => tracking.entries[group.value.id]?.session ?? null);
const sessionId = computed(() => session.value?.sessionId ?? null);
const sessionActive = computed(() => session.value?.status === 'active');
const user = computed(() => iam.user);
const isGuide = computed(() => user.value?.role === Roles.GUIDE);

const form = reactive({ description: '', severity: 'medium', type: 'medical', alertId: null });
const detail = reactive({ incidentId: null, note: '', description: '', location: '', status: 'in_progress', recipient: '' });
const confirming = ref('');

const cases = computed(() => incidents.incidents.filter((item) => item.expeditionGroupId === group.value.id));
const selected = computed(() => cases.value.find((item) => item.id === detail.incidentId) ?? null);
const linkedAlertIds = computed(() => new Set(cases.value.map((item) => item.alertId).filter(Boolean)));
const linkableAlerts = computed(() => safety.getEarlyWarningAlertsByGroupId(group.value.id)
    .filter((alert) => alert.sessionId === sessionId.value && alert.status !== 'dismissed' && !linkedAlertIds.value.has(alert.id)));
const linkedAlert = computed(() => linkableAlerts.value.find((alert) => alert.id === form.alertId) ?? null);
const actions = computed(() => selected.value?.availableActions(user.value, group.value) ?? []);
const persistedActions = computed(() => incidents.evacuations[detail.incidentId] ?? []);
const queuedActions = computed(() => incidents.outbox().filter((item) => item.incidentId === detail.incidentId));
const groupQueue = computed(() => incidents.outbox().filter((item) => item.expeditionGroupId === group.value.id));
const sentNotifications = computed(() => incidents.notifications[detail.incidentId] ?? []);
const unanswered = computed(() => incidents.pendingNotificationRequests()[detail.incidentId] ?? null);
const legacyCount = computed(() => incidents.legacyOutbox().filter((item) => item.expeditionGroupId === group.value.id).length);

/** Actions that change the incident for everyone ask for an explicit confirmation first. */
const confirmationRequired = new Set(['dismiss', 'declareEmergency', 'close']);
const actionLabels = {
    confirm: 'incidents.actions.confirm', dismiss: 'incidents.actions.dismiss',
    declareEmergency: 'incidents.actions.declareEmergency', resolve: 'incidents.actions.resolve', close: 'incidents.actions.close',
};

onMounted(() => execute(() => incidents.load(group.value, sessionId.value), ''));
watch(() => detail.incidentId, (id) => {
    confirming.value = '';
    if (id) execute(() => incidents.loadDetails(selected.value), '');
});

function linkAlert(alert) {
    form.alertId = alert.id;
    form.type = alert.type === 'vital-sign-anomaly' ? 'medical' : form.type;
    form.severity = IncidentSeverities.includes(alert.priority) ? alert.priority : form.severity;
    form.description ||= alert.description || t(`earlyWarningAlerts.type.${alert.type}`);
}

async function report() {
    const created = await execute(() => incidents.report(group.value, sessionId.value,
        { description: form.description, severity: form.severity, type: form.type, alert: linkedAlert.value }),
    'incidents.messages.reported');
    if (created) {
        Object.assign(form, { description: '', alertId: null });
        detail.incidentId = created.id;
    }
}

async function run(action) {
    if (confirmationRequired.has(action) && confirming.value !== action) { confirming.value = action; return; }
    confirming.value = '';
    const updated = await execute(() => incidents.transition(group.value, selected.value, action, detail.note),
        'incidents.messages.updated');
    if (updated) detail.note = '';
}

async function recordAction() {
    const queued = await execute(async () => {
        incidents.recordEvacuation(group.value, selected.value,
            { description: detail.description, location: detail.location, status: detail.status });
        Object.assign(detail, { description: '', location: '' });
        // The action stays queued when there is no connection; the next synchronization sends it.
        try { await incidents.flushEvacuations(group.value); } catch { return 'queued'; }
        return 'sent';
    }, 'incidents.messages.actionRecorded');
    if (queued === 'queued') message.value = 'incidents.messages.actionQueued';
}

async function notify(recipient = detail.recipient) {
    const sent = await execute(() => incidents.requestNotification(group.value, selected.value, recipient),
        'incidents.messages.notificationRequested');
    if (sent) detail.recipient = '';
}

function rejectionText(record) {
    return record.rejection?.code ? t(record.rejection.code) : '';
}
</script>

<template>
  <div class="vt-stack">
    <WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <p v-if="!sessionId" class="vt-notice" role="status">{{ t('incidents.sessionRequired') }}</p>

    <section v-if="sessionActive" class="vt-panel">
      <h2>{{ t('incidents.linkableAlerts') }}</h2>
      <p class="vt-preserve">{{ protocol?.instructions }}</p>
      <p v-if="!linkableAlerts.length">{{ t('incidents.noLinkableAlerts') }}</p>
      <article v-for="alert in linkableAlerts" :key="alert.id" class="vt-case">
        <div class="vt-page-header">
          <h3>{{ t(`earlyWarningAlerts.type.${alert.type}`) }}</h3>
          <span class="vt-badge">{{ t(`earlyWarningAlerts.priority.${alert.priority}`) }} · {{ t(`earlyWarningAlerts.status.${alert.status}`) }}</span>
        </div>
        <p>{{ alert.description }}</p>
        <small>{{ timestamp(alert.triggeredAt) }} · {{ age(alert.triggeredAt) }}</small>
        <div class="vt-actions">
          <button type="button" class="vt-button secondary" :disabled="busy" @click="linkAlert(alert)">{{ t('incidents.reportFromAlert') }}</button>
        </div>
      </article>
    </section>

    <div class="vt-grid">
      <section class="vt-panel">
        <h2>{{ t('incidents.report') }}</h2>
        <form v-if="sessionActive" class="vt-form" @submit.prevent="report">
          <label>{{ t('incidents.type') }}
            <select v-model="form.type"><option v-for="type in IncidentTypes" :key="type" :value="type">{{ t(`incidents.types.${type}`) }}</option></select>
          </label>
          <label>{{ t('workflow.severity') }}
            <select v-model="form.severity"><option v-for="level in IncidentSeverities" :key="level" :value="level">{{ t(`earlyWarningAlerts.priority.${level}`) }}</option></select>
          </label>
          <label>{{ t('workflow.description') }}<textarea v-model="form.description" required maxlength="500" rows="3" /></label>
          <p class="vt-muted">{{ t('incidents.descriptionHint') }}</p>
          <p v-if="linkedAlert">{{ t('incidents.linkedAlert', { type: t(`earlyWarningAlerts.type.${linkedAlert.type}`) }) }}
            <button type="button" class="vt-link" @click="form.alertId = null">{{ t('workflow.clear') }}</button>
          </p>
          <p v-else class="vt-muted">{{ t('incidents.manualReport') }}</p>
          <button class="vt-button" :disabled="busy">{{ t('incidents.report') }}</button>
        </form>
        <p v-else>{{ t('incidents.reportRequiresActiveSession') }}</p>

        <h3>{{ t('workflow.incidentLog') }}</h3>
        <ul class="vt-list">
          <li v-for="incident in cases" :key="incident.id">
            <strong>{{ t(`incidents.types.${incident.type}`) }} · {{ incident.description }}</strong>
            <span class="vt-badge">{{ t(`incidents.status.${incident.status}`) }}</span>
            <small>{{ t(`earlyWarningAlerts.priority.${incident.severity}`) }} · {{ timestamp(incident.reportedAt) }}</small>
            <button type="button" class="vt-button secondary" :aria-pressed="detail.incidentId === incident.id" @click="detail.incidentId = incident.id">{{ t('workflow.open') }}</button>
          </li>
        </ul>
        <p v-if="!cases.length">{{ t('workflow.empty') }}</p>
      </section>

      <section class="vt-panel" aria-live="polite">
        <template v-if="selected">
          <div class="vt-page-header">
            <h2>{{ t(`incidents.types.${selected.type}`) }}</h2>
            <span class="vt-badge">{{ t(`incidents.status.${selected.status}`) }}</span>
          </div>
          <p class="vt-preserve">{{ selected.description }}</p>
          <p class="vt-muted">{{ selected.alertId ? t('incidents.fromAlert') : t('incidents.manualOrigin') }} · {{ t('incidents.reportedAt') }}: {{ timestamp(selected.reportedAt) }} ({{ age(selected.reportedAt) }})</p>

          <template v-if="actions.length">
            <label>{{ t('workflow.actionNote') }}<textarea v-model="detail.note" rows="2" maxlength="500" /></label>
            <div class="vt-actions">
              <button v-for="action in actions" :key="action" type="button"
                      :class="['vt-button', action === 'declareEmergency' || action === 'dismiss' ? 'danger' : action === 'confirm' ? '' : 'secondary']"
                      :disabled="busy" @click="run(action)">
                {{ confirming === action ? t('incidents.actions.confirmAgain', { action: t(actionLabels[action]) }) : t(actionLabels[action]) }}
              </button>
            </div>
            <p v-if="confirming" class="vt-notice" role="alert">{{ t(`incidents.confirmations.${confirming}`) }}</p>
          </template>
          <p v-else-if="selected.isOpen" class="vt-muted">{{ t(isGuide ? 'incidents.waitingAdministrator' : 'incidents.waitingGuide') }}</p>
          <p v-if="isGuide && selected.status === 'confirmed'" class="vt-muted">{{ t('incidents.onlyAdministratorDeclares') }}</p>

          <h3>{{ t('incidents.history') }}</h3>
          <ol class="vt-timeline">
            <li v-for="(change, index) in selected.statusChanges" :key="index">
              <strong>{{ t(`incidents.status.${change.to}`) }}</strong>
              <p v-if="change.note" class="vt-preserve">{{ change.note }}</p>
              <small>{{ change.actorUserId === user?.id ? t('incidents.byYou') : t('incidents.byUser', { id: change.actorUserId }) }} · {{ timestamp(change.occurredAt) }}</small>
            </li>
          </ol>

          <template v-if="selected.emergencyDeclaredAt">
            <h3>{{ t('incidents.evacuation') }}</h3>
            <form v-if="selected.canRecordEvacuation(user, group)" class="vt-form vt-case" @submit.prevent="recordAction">
              <label>{{ t('workflow.description') }}<textarea v-model="detail.description" required maxlength="500" rows="2" /></label>
              <label>{{ t('workflow.location') }}<input v-model="detail.location" maxlength="200"></label>
              <label>{{ t('incidents.actionStatus') }}
                <select v-model="detail.status"><option v-for="status in EvacuationStatuses" :key="status" :value="status">{{ t(`incidents.evacuationStatus.${status}`) }}</option></select>
              </label>
              <p class="vt-muted">{{ t('incidents.offlineHint') }}</p>
              <button class="vt-button secondary" :disabled="busy">{{ t('workflow.recordAction') }}</button>
            </form>
            <ul class="vt-list">
              <li v-for="item in persistedActions" :key="item.id">
                <strong>{{ item.description }}</strong>
                <span>{{ item.location || '—' }} · {{ t(`incidents.evacuationStatus.${item.status}`) }}</span>
                <small>{{ t('incidents.capturedAt') }}: {{ timestamp(item.recordedAt) }} · {{ t('incidents.receivedAt') }}: {{ timestamp(item.synchronizedAt) }}</small>
              </li>
              <li v-for="item in queuedActions" :key="item.id">
                <strong>{{ item.description }}</strong>
                <span class="vt-badge">{{ item.rejection ? t('incidents.rejected') : t('incidents.queued') }}</span>
                <small>{{ t('incidents.capturedAt') }}: {{ timestamp(item.recordedAt) }}</small>
                <p v-if="item.rejection" class="vt-error">{{ rejectionText(item) }}
                  <button type="button" class="vt-link" @click="incidents.discardRejectedEvacuation(item.id)">{{ t('incidents.discard') }}</button>
                </p>
              </li>
            </ul>
            <p v-if="!persistedActions.length && !queuedActions.length">{{ t('workflow.empty') }}</p>
          </template>

          <template v-if="iam.isAdmin && selected.emergencyDeclaredAt">
            <h3>{{ t('incidents.communications') }}</h3>
            <p class="vt-notice">{{ t('incidents.testRecipientsOnly') }}</p>
            <form v-if="selected.canNotify(user)" class="vt-form vt-case" @submit.prevent="notify()">
              <label>{{ t('incidents.recipientEmail') }}<input v-model="detail.recipient" type="email" required maxlength="254" autocomplete="off"></label>
              <button class="vt-button" :disabled="busy">{{ t('incidents.requestNotification') }}</button>
            </form>
            <p v-if="unanswered" class="vt-notice" role="status">{{ t('incidents.unansweredRequest', { recipient: unanswered.recipient }) }}
              <button type="button" class="vt-link" :disabled="busy" @click="notify(unanswered.recipient)">{{ t('workflow.retry') }}</button>
            </p>
            <ul class="vt-list">
              <li v-for="item in sentNotifications" :key="item.notificationId">
                <strong>{{ item.recipient }}</strong>
                <span class="vt-badge">{{ t(`incidents.notificationStatus.${item.status}`) }}</span>
                <small>{{ t('incidents.attempts', { count: item.attemptCount }) }} · {{ timestamp(item.requestedAt) }}<template v-if="item.lastErrorCode || item.failureCode"> · {{ item.failureCode ?? item.lastErrorCode }}</template></small>
                <div class="vt-actions">
                  <button v-if="item.status === 'pending'" type="button" class="vt-button secondary" :disabled="busy" @click="execute(() => incidents.retryNotification(selected, item.notificationId))">{{ t('workflow.retry') }}</button>
                  <button v-if="item.status === 'accepted'" type="button" class="vt-button secondary" :disabled="busy" @click="execute(() => incidents.checkNotification(selected, item.notificationId))">{{ t('incidents.checkDelivery') }}</button>
                </div>
              </li>
            </ul>
          </template>
        </template>
        <p v-else>{{ t('workflow.selectIncident') }}</p>

        <p>{{ t('workflow.pendingEvacuations', { count: groupQueue.length }) }}</p>
        <button v-if="isGuide" type="button" class="vt-button secondary" :disabled="busy || !groupQueue.length" @click="execute(() => incidents.flushEvacuations(group), 'incidents.messages.synchronized')">{{ t('workflow.syncActions') }}</button>
        <p v-if="legacyCount" class="vt-notice">{{ t('incidents.legacyQueue', { count: legacyCount }) }}</p>
      </section>
    </div>
  </div>
</template>
