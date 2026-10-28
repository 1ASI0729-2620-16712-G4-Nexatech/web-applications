import { requireCondition } from '../../../shared/domain/application-error.js';
import { TelemetryRecord } from '../../../field-tracking/domain/model/telemetry-record.entity.js';

export class SyncBatch {
    constructor(resource) { Object.assign(this, { id: crypto.randomUUID(), status: 'pending', receivedAt: new Date().toISOString(), ...resource }); }
    validate(group, checkpoint, members, preparations) {
        requireCondition(group.status === 'active', 'workflow.errors.notActive');
        requireCondition(checkpoint?.routeId === group.routeId && checkpoint.bluetoothId, 'workflow.errors.checkpoint');
        requireCondition(this.records.length > 0, 'workflow.errors.emptyQueue');
        requireCondition(new Set(this.records.map((r) => r.id)).size === this.records.length);
        for (const record of this.records) {
            requireCondition(record.expeditionGroupId === group.id && record.agencyId === group.agencyId);
            if (record.kind === 'telemetry') {
                new TelemetryRecord(record).validate();
                requireCondition(members.some((m) => m.id === record.memberId) && preparations.some((p) => p.memberId === record.memberId && p.wearableId === record.wearableId && p.consent && p.activated), 'workflow.errors.preparation');
            } else requireCondition(record.kind === 'check-in' && Number.isFinite(Date.parse(record.recordedAt)));
        }
        this.records.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    }
}
