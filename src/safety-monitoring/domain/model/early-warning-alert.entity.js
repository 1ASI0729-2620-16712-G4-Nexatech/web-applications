import { RiskEvidence } from './risk-evidence.entity.js';

/** Statuses of an alert that still requires attention. */
export const OPEN_ALERT_STATUSES = Object.freeze(['active', 'acknowledged']);

/** Urgency of each priority, from the most to the least urgent. */
export const PRIORITY_RANK = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });

/**
 * Statuses from which each requested status can be reached. The server enforces the same transitions; the client
 * uses them only to offer the actions that make sense.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
    acknowledged: Object.freeze(['active']),
    dismissed: Object.freeze(['active', 'acknowledged']),
    resolved: Object.freeze(['acknowledged']),
});

/**
 * Early Warning Alert entity within the Safety Monitoring bounded context. Alerts are raised by the server from
 * persisted data; the client represents them and requests status transitions, but never evaluates risk.
 */
export class EarlyWarningAlert {
    /**
     * @param {Object} params - Early Warning Alert attributes.
     * @param {?number} [params.id=null] - Early Warning Alert identifier.
     * @param {?number} [params.sessionId=null] - Tracking session of the alert.
     * @param {?number} [params.expeditionGroupId=null] - Affected expedition group identifier.
     * @param {?number} [params.checkpointId=null] - Related checkpoint, for delays.
     * @param {?number} [params.memberId=null] - Participant concerned, for participant alerts.
     * @param {string} [params.type=''] - Risk condition type (delay, vital-sign-anomaly, route-deviation, other).
     * @param {string} [params.rule=''] - Rule that produced the alert (manual or one of the server rules).
     * @param {string} [params.priority=''] - Alert priority (low, medium, high, critical).
     * @param {string} [params.status='active'] - Alert status (active, acknowledged, resolved, dismissed).
     * @param {string} [params.description=''] - Description written by the server or the reporter.
     * @param {string} [params.triggeredAt=''] - ISO datetime when the server raised the alert.
     * @param {?string} [params.resolvedAt=null] - ISO datetime when the alert was resolved or dismissed.
     * @param {?number} [params.acknowledgedByUserId=null] - User who acknowledged the alert.
     * @param {?string} [params.acknowledgedAt=null] - ISO datetime of the acknowledgement.
     * @param {?number} [params.closedByUserId=null] - User who resolved or dismissed the alert.
     * @param {RiskEvidence[]} [params.riskEvidence=[]] - Evidence that sustains the alert.
     */
    constructor({
                    id = null,
                    sessionId = null,
                    expeditionGroupId = null,
                    checkpointId = null,
                    memberId = null,
                    type = '',
                    rule = '',
                    priority = '',
                    status = 'active',
                    description = '',
                    triggeredAt = '',
                    resolvedAt = null,
                    acknowledgedByUserId = null,
                    acknowledgedAt = null,
                    closedByUserId = null,
                    riskEvidence = [],
                    ...metadata
                } = {}) {
        Object.assign(this, metadata);
        this.id = id;
        this.sessionId = sessionId;
        this.expeditionGroupId = expeditionGroupId;
        this.checkpointId = checkpointId;
        this.memberId = memberId;
        this.type = type;
        this.rule = rule;
        this.priority = priority;
        this.status = status;
        this.description = description;
        this.triggeredAt = triggeredAt;
        this.resolvedAt = resolvedAt;
        this.acknowledgedByUserId = acknowledgedByUserId;
        this.acknowledgedAt = acknowledgedAt;
        this.closedByUserId = closedByUserId;
        this.riskEvidence = riskEvidence.map((evidence) => (
            evidence instanceof RiskEvidence ? evidence : new RiskEvidence(evidence)
        ));
    }

    /** @returns {boolean} Whether the alert still requires attention. */
    get isOpen() {
        return OPEN_ALERT_STATUSES.includes(this.status);
    }

    /** @returns {boolean} Whether the alert was reported manually instead of raised by a server rule. */
    get isManual() {
        return this.rule === 'manual';
    }

    /** @returns {?RiskEvidence} The main evidence of an evaluated alert. */
    get evidence() {
        return this.riskEvidence[0] ?? null;
    }

    /**
     * @param {string} status - Requested status: acknowledged, dismissed or resolved.
     * @returns {boolean} Whether the alert can move to that status from its current one.
     */
    canChangeTo(status) {
        return ALLOWED_TRANSITIONS[status]?.includes(this.status) ?? false;
    }
}
