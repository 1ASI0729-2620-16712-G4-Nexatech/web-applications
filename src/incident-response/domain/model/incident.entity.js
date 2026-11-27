import { Roles, canAccessGroup } from '../../../iam/domain/user.entity.js';

/** Lifecycle states shared with the RESTful API. */
export const IncidentStatuses = Object.freeze(['reported', 'confirmed', 'dismissed', 'emergency_declared', 'resolved', 'closed']);
export const IncidentTypes = Object.freeze(['medical', 'accident', 'missing', 'environmental']);
export const IncidentSeverities = Object.freeze(['low', 'medium', 'high', 'critical']);
export const OpenStatuses = Object.freeze(['reported', 'confirmed', 'emergency_declared']);

/**
 * Transition table of the API: client action, states it starts from, state it reaches and the roles that may run it.
 * The assigned guide verifies in the field; only an operations administrator declares the emergency.
 */
export const Transitions = Object.freeze({
    confirm: { from: ['reported'], to: 'confirmed', roles: [Roles.GUIDE] },
    dismiss: { from: ['reported'], to: 'dismissed', roles: [Roles.GUIDE] },
    declareEmergency: { from: ['confirmed'], to: 'emergency_declared', roles: [Roles.ADMIN] },
    resolve: { from: ['confirmed', 'emergency_declared'], to: 'resolved', roles: [Roles.GUIDE, Roles.ADMIN] },
    close: { from: ['resolved'], to: 'closed', roles: [Roles.GUIDE, Roles.ADMIN] },
});

/**
 * Incident entity of the Incident Response bounded context, built only from API resources. The client never changes
 * its state: it asks the API for a transition and replaces the entity with the answer.
 */
export class Incident {
    constructor({
        id, sessionId, expeditionGroupId, agencyId, alertId = null, reportedByUserId = null, reportedAt,
        type, severity, description = '', status, confirmedAt = null, dismissedAt = null,
        emergencyDeclaredAt = null, resolvedAt = null, closedAt = null, statusChanges = [],
    }) {
        Object.assign(this, {
            id, sessionId, expeditionGroupId, agencyId, alertId, reportedByUserId, reportedAt, type, severity,
            description, status, confirmedAt, dismissedAt, emergencyDeclaredAt, resolvedAt, closedAt, statusChanges,
        });
    }

    get isOpen() { return OpenStatuses.includes(this.status); }

    /** True when the role of the user allows the action from the current state; the API checks it again. */
    allows(action, user, group) {
        const transition = Transitions[action];
        return Boolean(transition && transition.from.includes(this.status) && transition.roles.includes(user?.role)
            && canAccessGroup(user, group));
    }

    /** Client actions the user may run now. */
    availableActions(user, group) {
        return Object.keys(Transitions).filter((action) => this.allows(action, user, group));
    }

    /** Only the assigned guide records evacuation actions, during a declared emergency. */
    canRecordEvacuation(user, group) {
        return this.status === 'emergency_declared' && user?.role === Roles.GUIDE && canAccessGroup(user, group);
    }

    /** Only an operations administrator requests external communications, during a declared emergency. */
    canNotify(user) {
        return this.status === 'emergency_declared' && user?.role === Roles.ADMIN;
    }
}

/** States of an evacuation action when it was captured. */
export const EvacuationStatuses = Object.freeze(['in_progress', 'completed', 'aborted']);

/** Delivery states of a notification. Accepted means the provider took it; only delivered is a confirmation. */
export const NotificationStatuses = Object.freeze(['pending', 'accepted', 'delivered', 'failed']);
