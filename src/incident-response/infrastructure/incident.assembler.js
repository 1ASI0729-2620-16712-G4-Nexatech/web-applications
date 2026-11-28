import {
    EvacuationStatuses, Incident, IncidentSeverities, IncidentStatuses, IncidentTypes, NotificationStatuses,
} from '../domain/model/incident.entity.js';

/** Legacy status of the first API version, read as its current equivalent. */
const LEGACY_STATUSES = Object.freeze({ inresponse: 'confirmed', in_response: 'confirmed' });

const isId = (value) => Number.isInteger(value) && value > 0;
const isText = (value) => typeof value === 'string';

function statusOf(code) {
    const status = LEGACY_STATUSES[code] ?? code;
    return IncidentStatuses.includes(status) ? status : null;
}

/**
 * Maps Incident Response resources of the VitalTrek RESTful API into entities. Every code is mapped explicitly: a
 * resource with an unknown status, type or severity is dropped instead of being shown with a raw code.
 */
export class IncidentAssembler {
    /** @returns {?Incident} The incident, or null when it cannot be represented safely. */
    static toEntityFromResource(resource) {
        const status = statusOf(resource?.status);
        if (!resource || !isId(resource.id) || !status || !IncidentTypes.includes(resource.incidentType)
            || !IncidentSeverities.includes(resource.severity)) return null;
        return new Incident({
            id: resource.id,
            sessionId: resource.sessionId,
            expeditionGroupId: resource.expeditionGroupId,
            agencyId: resource.agencyId,
            alertId: isId(resource.alertId) ? resource.alertId : null,
            reportedByUserId: resource.reportedByUserId ?? null,
            reportedAt: resource.reportedAt,
            type: resource.incidentType,
            severity: resource.severity,
            description: isText(resource.description) ? resource.description : '',
            status,
            confirmedAt: resource.confirmedAt ?? null,
            dismissedAt: resource.dismissedAt ?? null,
            emergencyDeclaredAt: resource.emergencyDeclaredAt ?? null,
            resolvedAt: resource.resolvedAt ?? null,
            closedAt: resource.closedAt ?? null,
            statusChanges: (Array.isArray(resource.statusChanges) ? resource.statusChanges : [])
                .map((change) => ({
                    from: change.fromStatus ? statusOf(change.fromStatus) : null,
                    to: statusOf(change.toStatus),
                    actorUserId: change.actorUserId,
                    note: change.note ?? '',
                    occurredAt: change.occurredAt,
                }))
                .filter((change) => change.to),
        });
    }

    /** @returns {Incident[]} The readable incidents of a collection response. */
    static toEntitiesFromResponse(response) {
        if (response?.status !== 200 || !Array.isArray(response.data)) return [];
        return response.data.map((resource) => this.toEntityFromResource(resource)).filter(Boolean);
    }

    /** Builds the report resource; the agency, group and author are resolved by the server. */
    static toReportResource({ sessionId, type, severity, description, alertId = null, reportedAt }) {
        return {
            sessionId, incidentType: type, severity, description: description.trim(), reportedAt,
            ...(isId(alertId) ? { alertId } : {}),
        };
    }
}

/** Maps evacuation action resources; RecordedAt is the capture and SynchronizedAt the reception. */
export class EvacuationActionAssembler {
    static toEntityFromResource(resource) {
        if (!resource || !isId(resource.id) || !EvacuationStatuses.includes(resource.status)) return null;
        return {
            id: resource.id, clientActionId: resource.clientActionId, incidentId: resource.incidentId,
            expeditionGroupId: resource.expeditionGroupId, recordedByUserId: resource.recordedByUserId,
            description: resource.description ?? '', location: resource.location ?? '', status: resource.status,
            recordedAt: resource.recordedAt, synchronizedAt: resource.synchronizedAt,
        };
    }

    static toEntitiesFromResponse(response) {
        if (response?.status !== 200 || !Array.isArray(response.data)) return [];
        return response.data.map((resource) => this.toEntityFromResource(resource)).filter(Boolean);
    }

    /** Builds the resource sent for a queued action; it keeps the client identity and the original capture. */
    static toResource(queued) {
        return {
            clientActionId: queued.clientActionId, description: queued.description, location: queued.location || null,
            status: queued.status, recordedAt: queued.recordedAt,
        };
    }
}

/** Maps notification resources. Accepted and delivered stay distinct states. */
export class NotificationAssembler {
    static toEntityFromResource(resource) {
        if (!resource || !isText(resource.notificationId) || !NotificationStatuses.includes(resource.status)) return null;
        return {
            notificationId: resource.notificationId, incidentId: resource.incidentId, recipient: resource.recipientEmail ?? '',
            status: resource.status, requestedAt: resource.requestedAt, attemptCount: resource.attemptCount ?? 0,
            lastAttemptAt: resource.lastAttemptAt ?? null, lastErrorCode: resource.lastErrorCode ?? null,
            acceptedAt: resource.acceptedAt ?? null, deliveredAt: resource.deliveredAt ?? null,
            failedAt: resource.failedAt ?? null, failureCode: resource.failureCode ?? null,
        };
    }

    static toEntitiesFromResponse(response) {
        if (response?.status !== 200 || !Array.isArray(response.data)) return [];
        return response.data.map((resource) => this.toEntityFromResource(resource)).filter(Boolean);
    }
}

/** Stable API error codes of Incident Response and the i18n keys that explain them. */
const ERROR_KEYS = Object.freeze({
    'Incident.InvalidData': 'incidents.errors.invalidData',
    'Incident.AccessForbidden': 'workflow.errors.forbidden',
    'Incident.SessionNotFound': 'incidents.errors.sessionNotFound',
    'Incident.SessionNotActive': 'workflow.errors.notActive',
    'Incident.AlertNotFound': 'incidents.errors.alertNotFound',
    'Incident.AlertOutsideSession': 'incidents.errors.alertOutsideSession',
    'Incident.AlertDismissed': 'incidents.errors.alertDismissed',
    'Incident.AlertAlreadyLinked': 'incidents.errors.alertAlreadyLinked',
    'Incident.InvalidStatus': 'incidents.errors.invalidData',
    'Incident.TransitionForbidden': 'incidents.errors.transitionForbidden',
    'Incident.NotFound': 'incidents.errors.notFound',
    'Incident.InvalidTransition': 'incidents.errors.invalidTransition',
    'EvacuationAction.InvalidData': 'incidents.errors.evacuationInvalid',
    'EvacuationAction.AccessForbidden': 'incidents.errors.evacuationForbidden',
    'EvacuationAction.IncidentNotFound': 'incidents.errors.notFound',
    'EvacuationAction.EmergencyNotDeclared': 'incidents.errors.evacuationRequiresEmergency',
    'EvacuationAction.IdentityConflict': 'incidents.errors.evacuationConflict',
    'IncidentNotification.InvalidData': 'incidents.errors.notificationInvalid',
    'IncidentNotification.AccessForbidden': 'incidents.errors.notificationForbidden',
    'IncidentNotification.IncidentNotFound': 'incidents.errors.notFound',
    'IncidentNotification.EmergencyNotDeclared': 'incidents.errors.notificationRequiresEmergency',
    'IncidentNotification.RecipientNotAllowed': 'incidents.errors.recipientNotAllowed',
    'IncidentNotification.NotFound': 'incidents.errors.notFound',
    'IncidentNotification.IdentityConflict': 'incidents.errors.notificationConflict',
    'IncidentNotification.AttemptInProgress': 'incidents.errors.attemptInProgress',
    'IncidentNotification.NotRetriable': 'incidents.errors.notRetriable',
});

export const IncidentErrorKeys = ERROR_KEYS;

/** Returns the i18n key of a coded API refusal, or null when the response carries no known code. */
export function toIncidentErrorKey(cause) {
    const code = cause?.response?.data?.code;
    return typeof code === 'string' ? ERROR_KEYS[code] ?? null : null;
}
