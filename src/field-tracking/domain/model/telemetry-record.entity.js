import { requireCondition } from '../../../shared/domain/application-error.js';

export class TelemetryRecord {
    constructor(resource) { Object.assign(this, { id: crypto.randomUUID(), kind: 'telemetry', recordedAt: new Date().toISOString(), ...resource }); }
    validate() {
        requireCondition(this.memberId && this.wearableId && this.expeditionGroupId);
        requireCondition(Number.isFinite(this.heartRate) && this.heartRate > 0);
        requireCondition(Number.isFinite(this.latitude) && Math.abs(this.latitude) <= 90);
        requireCondition(Number.isFinite(this.longitude) && Math.abs(this.longitude) <= 180);
        requireCondition(Number.isFinite(this.deviationMeters) && this.deviationMeters >= 0);
        requireCondition(Number.isFinite(this.battery) && this.battery >= 0 && this.battery <= 100);
        requireCondition(Number.isFinite(Date.parse(this.recordedAt)) && Date.parse(this.recordedAt) <= Date.now() + 60000);
    }
}
