<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlertTime } from '../use-alert-time.js';

/**
 * One early warning alert: the rule that raised it, its evidence with the original capture time, who acknowledged or
 * closed it and when, and the transitions the current user may request. The parent performs the transitions.
 */
const props = defineProps({
  alert: { type: Object, required: true },
  memberName: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  errorKey: { type: String, default: '' },
  userLabel: { type: Function, default: (userId) => (userId == null ? '—' : `#${userId}`) },
});

const emit = defineEmits(['change-status']);

const { t } = useI18n();
const { timestamp, age } = useAlertTime();

const ACTIONS = Object.freeze([
  { status: 'acknowledged', label: 'earlyWarningAlerts.acknowledge', severity: 'secondary', outlined: true },
  { status: 'resolved', label: 'earlyWarningAlerts.resolve', severity: undefined, outlined: false },
  { status: 'dismissed', label: 'earlyWarningAlerts.dismissAsFalseAlarm', severity: 'danger', outlined: true },
]);

const evidence = computed(() => props.alert.evidence);

const actions = computed(() => (
  props.canManage && props.alert.isOpen
      ? ACTIONS.filter((action) => props.alert.canChangeTo(action.status))
      : []
));

const closedAuditKey = computed(() => (
  props.alert.status === 'resolved' ? 'earlyWarningAlerts.audit.resolved' : 'earlyWarningAlerts.audit.dismissed'
));
</script>

<template>
  <article class="alert-item" :class="{ closed: !alert.isOpen }">
    <div class="alert-item-header">
      <div class="alert-item-tags">
        <span class="priority-tag" :class="alert.priority">
          <i class="pi pi-exclamation-triangle" />
          {{ t(`earlyWarningAlerts.priority.${alert.priority}`) }}
        </span>
        <span class="status-tag" :class="alert.status">
          {{ t(`earlyWarningAlerts.status.${alert.status}`) }}
        </span>
      </div>
      <span class="alert-time">
        {{ t('earlyWarningAlerts.raisedAt', { time: timestamp(alert.triggeredAt), age: age(alert.triggeredAt) }) }}
      </span>
    </div>

    <h3>
      {{ t(`earlyWarningAlerts.type.${alert.type}`) }}
      <span v-if="memberName" class="alert-member">· {{ memberName }}</span>
    </h3>
    <p class="alert-rule">{{ t(`earlyWarningAlerts.rule.${alert.rule}`) }}</p>
    <p v-if="alert.isManual && alert.description" class="alert-description">{{ alert.description }}</p>

    <dl v-if="evidence" class="evidence">
      <div>
        <dt>{{ t(`earlyWarningAlerts.metric.${evidence.metricType}`) }}</dt>
        <dd>
          {{ t('earlyWarningAlerts.observedValue') }}: <strong>{{ evidence.observedValue }}</strong>
          <template v-if="evidence.expectedValue">
            · {{ t('earlyWarningAlerts.expectedValue') }}: {{ evidence.expectedValue }}
          </template>
        </dd>
      </div>
      <div>
        <dt>{{ t('earlyWarningAlerts.capturedAt') }}</dt>
        <dd>{{ timestamp(evidence.recordedAt) }} · {{ age(evidence.recordedAt) }}</dd>
      </div>
    </dl>
    <p v-if="evidence?.simulated" class="simulated-notice">
      <i class="pi pi-info-circle" />
      {{ t('earlyWarningAlerts.simulatedNotice') }}
    </p>

    <ul v-if="alert.acknowledgedAt || alert.resolvedAt" class="audit">
      <li v-if="alert.acknowledgedAt">
        {{ t('earlyWarningAlerts.audit.acknowledged', {
          user: userLabel(alert.acknowledgedByUserId), time: timestamp(alert.acknowledgedAt),
        }) }}
      </li>
      <li v-if="alert.resolvedAt">
        {{ t(closedAuditKey, { user: userLabel(alert.closedByUserId), time: timestamp(alert.resolvedAt) }) }}
      </li>
    </ul>

    <p v-if="errorKey" class="request-error" role="alert">{{ t(errorKey) }}</p>

    <div v-if="actions.length" class="alert-actions">
      <pv-button
          v-for="action in actions"
          :key="action.status"
          type="button"
          size="small"
          :label="t(action.label)"
          :severity="action.severity"
          :outlined="action.outlined"
          :disabled="busy"
          @click="emit('change-status', action.status)"
      />
    </div>
  </article>
</template>

<style scoped>
.alert-item {
  display: grid;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--vt-border);
  border-radius: 0.875rem;
  background: var(--vt-surface-soft);
}

.alert-item.closed {
  opacity: 0.78;
}

h3,
p,
ul,
dl {
  margin: 0;
}

h3 {
  color: var(--vt-text);
  font-size: 1rem;
}

.alert-member {
  color: var(--vt-muted);
  font-weight: 600;
}

.alert-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.alert-item-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-time,
.alert-rule,
.audit {
  color: var(--vt-muted);
  font-size: 0.8rem;
}

.alert-description {
  color: var(--vt-text);
  font-size: 0.85rem;
}

.priority-tag,
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.priority-tag.low {
  background: #e6f8ef;
  color: #157347;
}

.priority-tag.medium {
  background: #fff4dc;
  color: #9b5b00;
}

.priority-tag.high {
  background: #fdeceb;
  color: var(--vt-danger);
}

.priority-tag.critical {
  background: var(--vt-danger);
  color: #ffffff;
}

.status-tag.active {
  background: #fdeceb;
  color: var(--vt-danger);
}

.status-tag.acknowledged {
  background: #fff4dc;
  color: #9b5b00;
}

.status-tag.resolved,
.status-tag.dismissed {
  background: #e6f8ef;
  color: #157347;
}

.evidence {
  display: grid;
  gap: 0.35rem;
  font-size: 0.82rem;
}

.evidence div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.evidence dt {
  color: var(--vt-muted);
}

.evidence dd {
  margin: 0;
  color: var(--vt-text);
  text-align: right;
}

.simulated-notice {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  justify-self: start;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: #eef4ff;
  color: #2952a3;
  font-size: 0.75rem;
  font-weight: 600;
}

.audit {
  display: grid;
  gap: 0.2rem;
  padding-left: 1rem;
}

.request-error {
  color: #b42318;
  font-size: 0.8rem;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

@media (max-width: 760px) {
  .alert-item-header,
  .evidence div {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
  }

  .evidence dd {
    text-align: left;
  }

  .alert-actions {
    justify-content: flex-start;
  }
}
</style>
