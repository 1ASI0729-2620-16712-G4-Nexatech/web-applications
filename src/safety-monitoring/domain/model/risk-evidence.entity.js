/**
 * Risk Evidence value object within the Safety Monitoring bounded context. It keeps the numeric values the server
 * evaluated together with their display text, the original capture time of the observation and whether the value
 * comes from the academic simulation.
 */
export class RiskEvidence {
    /**
     * @param {Object} params - Risk Evidence attributes.
     * @param {string} [params.metricType=''] - Evaluated metric (heart-rate, route-position, elapsed-time).
     * @param {string} [params.observedValue=''] - Observed value with its unit, for display (e.g. "160 bpm").
     * @param {string} [params.expectedValue=''] - Expected value or range with its unit, for display.
     * @param {string} [params.recordedAt=''] - ISO datetime when the observation was captured.
     * @param {?number} [params.observed=null] - Observed numeric value.
     * @param {?number} [params.expectedMinimum=null] - Lowest expected value, if any.
     * @param {?number} [params.expectedMaximum=null] - Highest expected value, if any.
     * @param {string} [params.unit=''] - Unit of the values (bpm, m, min).
     * @param {?string} [params.sourceRecordId=null] - Client identity of the reading or passage behind the evidence.
     * @param {boolean} [params.simulated=false] - Whether the value comes from the academic simulation.
     */
    constructor({
                    metricType = '',
                    observedValue = '',
                    expectedValue = '',
                    recordedAt = '',
                    observed = null,
                    expectedMinimum = null,
                    expectedMaximum = null,
                    unit = '',
                    sourceRecordId = null,
                    simulated = false,
                    ...metadata
                } = {}) {
        Object.assign(this, metadata);
        this.metricType = metricType;
        this.observedValue = observedValue;
        this.expectedValue = expectedValue;
        this.recordedAt = recordedAt;
        this.observed = observed;
        this.expectedMinimum = expectedMinimum;
        this.expectedMaximum = expectedMaximum;
        this.unit = unit;
        this.sourceRecordId = sourceRecordId;
        this.simulated = simulated;
    }
}
