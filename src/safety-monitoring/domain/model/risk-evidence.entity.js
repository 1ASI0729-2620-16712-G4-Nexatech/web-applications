/**
 * Risk Evidence value object within the Safety Monitoring bounded context.
 */
export class RiskEvidence {
    /**
     * @param {Object} params - Risk Evidence attributes.
     * @param {string} [params.metricType=''] - Evaluated metric (e.g. elapsed-time, heart-rate, route-position).
     * @param {string} [params.observedValue=''] - Value observed during the risk evaluation.
     * @param {string} [params.expectedValue=''] - Value or range expected for that metric.
     * @param {string} [params.recordedAt=''] - ISO datetime when the underlying telemetry was recorded.
     */
    constructor({
                    metricType = '',
                    observedValue = '',
                    expectedValue = '',
                    recordedAt = '',
                } = {}) {
        this.metricType = metricType;
        this.observedValue = observedValue;
        this.expectedValue = expectedValue;
        this.recordedAt = recordedAt;
    }
}
