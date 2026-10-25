import { requireCondition } from '../../../shared/domain/application-error.js';

export class TourClosure {
    constructor(resource) { Object.assign(this, { status: 'closing', ...resource }); }
    validate(group, preparations, returns, openIncidents, pendingRecords, confirmations) {
        requireCondition(group.status === 'active', 'workflow.errors.notActive');
        requireCondition(!openIncidents.length || confirmations.incidents, 'workflow.errors.openIncidents');
        requireCondition(!pendingRecords.length || confirmations.incomplete, 'workflow.errors.pendingSync');
        const assigned = preparations.filter((p) => p.expeditionGroupId === group.id && p.wearableId);
        requireCondition(assigned.every((p) => returns.some((r) => r.wearableId === p.wearableId && ['good', 'maintenance', 'lost'].includes(r.condition))), 'workflow.errors.returns');
    }
}
