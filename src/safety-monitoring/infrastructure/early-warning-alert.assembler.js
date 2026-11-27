import { EarlyWarningAlert } from '../domain/model/early-warning-alert.entity.js';
import { RiskEvidence } from '../domain/model/risk-evidence.entity.js';

/** API alert type codes (snake_case) and the client vocabulary used by the views and the i18n keys. */
const ALERT_TYPES = Object.freeze({
    delay: 'delay',
    vital_sign_anomaly: 'vital-sign-anomaly',
    route_deviation: 'route-deviation',
    other: 'other',
});

const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const STATUSES = new Set(['active', 'acknowledged', 'dismissed', 'resolved']);
const RULES = new Set(['manual', 'heart_rate_outside_baseline', 'simulated_route_deviation', 'checkpoint_delay']);

/** Evidence units of the API and the metric they measure. */
const METRICS_BY_UNIT = Object.freeze({ bpm: 'heart-rate', m: 'route-position', min: 'elapsed-time' });

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function expectedRange(minimum, maximum, unit) {
    if (isNumber(minimum) && isNumber(maximum)) return `${minimum}–${maximum} ${unit}`;
    if (isNumber(maximum)) return `≤ ${maximum} ${unit}`;
    return isNumber(minimum) ? `≥ ${minimum} ${unit}` : '';
}

/**
 * Maps the Early Warning Alert resources of the VitalTrek RESTful API into domain entities. The mapping of every
 * code is explicit: an alert with an unknown type, priority, status, rule or evidence unit is dropped instead of being
 * shown with a raw code.
 */
export class EarlyWarningAlertAssembler {
    /** @returns {?RiskEvidence} The evidence, or null when the resource has none or it cannot be read. */
    static toEvidenceFromResource(resource) {
        if (!resource || !isNumber(resource.observedValue) || !METRICS_BY_UNIT[resource.unit]) return null;
        const minimum = isNumber(resource.expectedMinimum) ? resource.expectedMinimum : null;
        const maximum = isNumber(resource.expectedMaximum) ? resource.expectedMaximum : null;
        return new RiskEvidence({
            metricType: METRICS_BY_UNIT[resource.unit],
            observedValue: `${resource.observedValue} ${resource.unit}`,
            expectedValue: expectedRange(minimum, maximum, resource.unit),
            recordedAt: resource.recordedAt ?? '',
            observed: resource.observedValue,
            expectedMinimum: minimum,
            expectedMaximum: maximum,
            unit: resource.unit,
            sourceRecordId: resource.sourceRecordId ?? null,
            simulated: resource.simulated === true,
        });
    }

    /** @returns {?EarlyWarningAlert} The alert, or null when the resource cannot be represented safely. */
    static toEntityFromResource(resource) {
        if (!resource || !Number.isInteger(resource.id) || !ALERT_TYPES[resource.alertType]
            || !PRIORITIES.has(resource.severity) || !STATUSES.has(resource.status) || !RULES.has(resource.rule))
            return null;
        const evidence = resource.evidence == null ? null : this.toEvidenceFromResource(resource.evidence);
        if (resource.evidence != null && !evidence) return null;
        return new EarlyWarningAlert({
            id: resource.id,
            sessionId: resource.sessionId ?? null,
            expeditionGroupId: resource.expeditionGroupId ?? null,
            checkpointId: resource.checkpointId ?? null,
            memberId: resource.memberId ?? null,
            type: ALERT_TYPES[resource.alertType],
            rule: resource.rule,
            priority: resource.severity,
            status: resource.status,
            description: resource.description ?? '',
            triggeredAt: resource.raisedAt ?? '',
            resolvedAt: resource.closedAt ?? null,
            acknowledgedByUserId: resource.acknowledgedByUserId ?? null,
            acknowledgedAt: resource.acknowledgedAt ?? null,
            closedByUserId: resource.closedByUserId ?? null,
            riskEvidence: evidence ? [evidence] : [],
        });
    }

    /** @returns {EarlyWarningAlert[]} The readable alerts of a collection response. */
    static toEntitiesFromResponse(response) {
        if (response?.status !== 200 || !Array.isArray(response.data)) return [];
        return response.data
            .map((resource) => this.toEntityFromResource(resource))
            .filter((alert) => alert !== null);
    }
}
