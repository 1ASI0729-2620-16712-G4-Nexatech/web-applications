import { BaseApi } from '../../shared/infrastructure/base-api.js';

const incidentsPath = import.meta.env.VITE_INCIDENTS_ENDPOINT_PATH || '/incidents';

/** Explicit transition endpoints of the incident lifecycle, by client action. */
export const TransitionPaths = Object.freeze({
    confirm: 'confirm',
    dismiss: 'dismiss',
    declareEmergency: 'declare-emergency',
    resolve: 'resolve',
    close: 'close',
});

/**
 * REST gateway for the Incident Response bounded context of the VitalTrek RESTful API. The server resolves the agency,
 * the expedition group and the role of the user; the client only sends what was captured in the field.
 */
export class IncidentResponseApi extends BaseApi {
    /** Reads the open incidents of the groups the authenticated user can see. */
    getOpenIncidents() {
        return this.http.get(incidentsPath);
    }

    /** Reads every incident of a tracking session, closed ones included. */
    getIncidentsBySession(sessionId) {
        return this.http.get(incidentsPath, { params: { sessionId } });
    }

    /** Reports an incident, manually or from an early warning alert of the same session. */
    reportIncident(resource) {
        return this.http.post(incidentsPath, resource);
    }

    /** Executes one explicit transition: confirm, dismiss, declareEmergency, resolve or close. */
    transition(incidentId, action, note) {
        const path = TransitionPaths[action];
        if (!path) throw new Error(`Unknown incident transition ${action}`);
        return this.http.patch(`${incidentsPath}/${incidentId}/${path}`, note ? { note } : {});
    }

    /** Reads the evacuation actions of an incident ordered by capture time. */
    getEvacuationActions(incidentId) {
        return this.http.get(`${incidentsPath}/${incidentId}/evacuation-actions`);
    }

    /** Sends one captured evacuation action; a retry with the same clientActionId returns the first record. */
    recordEvacuationAction(incidentId, resource) {
        return this.http.post(`${incidentsPath}/${incidentId}/evacuation-actions`, resource);
    }

    /** Reads the notifications requested for an incident. */
    getNotifications(incidentId) {
        return this.http.get(`${incidentsPath}/${incidentId}/notifications`);
    }

    /** Requests an e-mail notification; repeating it with the same notificationId never sends a second message. */
    requestNotification(incidentId, resource) {
        return this.http.post(`${incidentsPath}/${incidentId}/notifications`, resource);
    }

    /** Retries a pending notification with its persisted identity. */
    retryNotification(incidentId, notificationId) {
        return this.http.post(`${incidentsPath}/${incidentId}/notifications/${notificationId}/attempts`);
    }

    /** Asks the server to query the provider for the delivery state of an accepted notification. */
    checkNotification(incidentId, notificationId) {
        return this.http.post(`${incidentsPath}/${incidentId}/notifications/${notificationId}/status-checks`);
    }
}
