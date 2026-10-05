import { RiskEvidence } from './risk-evidence.entity.js';

/**
 * Early Warning Alert entity within the Safety Monitoring bounded context.
 */
export class EarlyWarningAlert {
    /**
     * @param {Object} params - Early Warning Alert attributes.
     * @param {?number} [params.id=null] - Early Warning Alert identifier.
     * @param {?number} [params.expeditionGroupId=null] - Affected expedition group identifier.
     * @param {string} [params.type=''] - Risk condition type (delay, vital-sign-anomaly, route-deviation).
     * @param {string} [params.priority=''] - Alert priority (low, medium, high).
     * @param {string} [params.status='active'] - Alert status (active, acknowledged, resolved, dismissed).
     * @param {string} [params.triggeredAt=''] - ISO datetime when the alert was raised.
     * @param {?string} [params.resolvedAt=null] - ISO datetime when the alert was closed.
     * @param {RiskEvidence[]} [params.riskEvidence=[]] - Evidence that sustains the alert.
     */
    constructor({
                    id = null,
                    expeditionGroupId = null,
                    type = '',
                    priority = '',
                    status = 'active',
                    triggeredAt = '',
                    resolvedAt = null,
                    riskEvidence = [],
                } = {}) {
        this.id = id;
        this.expeditionGroupId = expeditionGroupId;
        this.type = type;
        this.priority = priority;
        this.status = status;
        this.triggeredAt = triggeredAt;
        this.resolvedAt = resolvedAt;
        this.riskEvidence = riskEvidence.map((evidence) => (
            evidence instanceof RiskEvidence ? evidence : new RiskEvidence(evidence)
        ));
    }
}
