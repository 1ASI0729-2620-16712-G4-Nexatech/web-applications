import { requireCondition } from '../../../shared/domain/application-error.js';

export class TelemetryRecord {
    constructor({
        sessionId, expeditionGroupId, agencyId, fieldGuideId, userId, memberId, wearableDeviceId,
        heartRate, battery, latitude, longitude, altitude, deviationMeters,
    }) {
        const clientRecordId = crypto.randomUUID();
        Object.assign(this, {
            id: clientRecordId, clientRecordId, kind: 'telemetry', recordedAt: new Date().toISOString(),
            sessionId, expeditionGroupId, agencyId, fieldGuideId, userId, memberId, wearableDeviceId,
            wearableId: wearableDeviceId, heartRate, battery, latitude, longitude, altitude,
            deviationMeters, isDeviationSimulated: true,
        });
    }

    validate() {
        requireCondition([this.sessionId, this.memberId, this.wearableDeviceId, this.expeditionGroupId]
            .every((id) => Number.isInteger(id) && id > 0));
        requireCondition(Number.isInteger(this.heartRate) && this.heartRate > 0);
        requireCondition(Number.isInteger(this.battery) && this.battery >= 0 && this.battery <= 100);
        requireCondition(Number.isFinite(this.latitude) && Math.abs(this.latitude) <= 90);
        requireCondition(Number.isFinite(this.longitude) && Math.abs(this.longitude) <= 180);
        requireCondition(Number.isFinite(this.altitude));
        requireCondition(Number.isFinite(this.deviationMeters) && this.deviationMeters >= 0);
    }
}
