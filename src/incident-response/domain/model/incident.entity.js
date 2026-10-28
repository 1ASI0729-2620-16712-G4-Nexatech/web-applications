import { requireCondition } from '../../../shared/domain/application-error.js';

const transitions = { reported: ['confirmed', 'closed'], confirmed: ['emergency_declared', 'closed'], emergency_declared: ['closed'], closed: [] };
export class Incident {
    constructor(resource) { Object.assign(this, { id: crypto.randomUUID(), status: 'reported', severity: 'medium', declaredAt: new Date().toISOString(), evidence: [], ...resource }); }
    transition(status, note) {
        requireCondition(transitions[this.status]?.includes(status), 'workflow.errors.transition');
        requireCondition(note?.trim(), 'workflow.errors.description');
        return new Incident({ ...this, status, evidence: [...this.evidence, { action: status, note: note.trim(), recordedAt: new Date().toISOString() }], closedAt: status === 'closed' ? new Date().toISOString() : null });
    }
}
