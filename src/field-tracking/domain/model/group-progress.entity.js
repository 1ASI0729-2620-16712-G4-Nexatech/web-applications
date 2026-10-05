/**
 * Group Progress entity within the Field Tracking bounded context.
 */
export class GroupProgress {
    /**
     * @param {Object} params - Group Progress attributes.
     * @param {?number} [params.id=null] - Group Progress identifier.
     * @param {?number} [params.expeditionGroupId=null] - Associated expedition group identifier.
     * @param {string} [params.lastConfirmedCheckpointLabel=''] - Last checkpoint confirmed by the group.
     * @param {string} [params.currentSegmentLabel=''] - Route segment currently being traveled.
     * @param {?number} [params.estimatedProgressPercentage=null] - Estimated route progress (0-100).
     * @param {string} [params.recordedAt=''] - ISO datetime when the telemetry was recorded.
     * @param {string} [params.synchronizedAt=''] - ISO datetime when the telemetry was synchronized.
     * @param {string} [params.status=''] - Mock tracking status.
     * @param {string} [params.riskLevel=''] - Mock risk level.
     */
    constructor({
                    id = null,
                    expeditionGroupId = null,
                    lastConfirmedCheckpointLabel = '',
                    currentSegmentLabel = '',
                    estimatedProgressPercentage = null,
                    recordedAt = '',
                    synchronizedAt = '',
                    status = '',
                    riskLevel = '',
                } = {}) {
        this.id = id;
        this.expeditionGroupId = expeditionGroupId;
        this.lastConfirmedCheckpointLabel = lastConfirmedCheckpointLabel;
        this.currentSegmentLabel = currentSegmentLabel;
        this.estimatedProgressPercentage = estimatedProgressPercentage;
        this.recordedAt = recordedAt;
        this.synchronizedAt = synchronizedAt;
        this.status = status;
        this.riskLevel = riskLevel;
    }
}
