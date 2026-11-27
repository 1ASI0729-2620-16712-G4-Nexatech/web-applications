import { ref } from 'vue';
import { defineStore } from 'pinia';
import {
    EvacuationStatuses, Incident, IncidentSeverities, IncidentTypes,
} from '../domain/model/incident.entity.js';
import { IncidentResponseApi } from '../infrastructure/incident-response-api.js';
import {
    EvacuationActionAssembler, IncidentAssembler, NotificationAssembler, toIncidentErrorKey,
} from '../infrastructure/incident.assembler.js';
import { createActionState } from '../../shared/application/action-state.js';
import { ApplicationError, requireCondition } from '../../shared/domain/application-error.js';
import { readLocal, writeLocal } from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

/** Kind of the queued records of this store, so other offline queues never discard them. */
export const EvacuationRecordKind = 'evacuation-action';

const api = new IncidentResponseApi();
const MAX_DESCRIPTION = 500, MAX_LOCATION = 200, MAX_NOTE = 500;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
/** Refusals that will not change by sending the same action again; the action stays visible with its reason. */
const FINAL_REFUSALS = new Set([400, 404, 409, 422]);

export default defineStore('incidentResponse', () => {
    const incidents = ref([]), evacuations = ref({}), notifications = ref({}), revision = ref(0);
    const state = createActionState();
    let flushing = false;

    const user = () => useIamStore().user;
    /** Queue of one user in one agency; each record keeps its group, session, incident and client identity. */
    const outboxKey = () => `vitaltrek-evacuations-v2-${user()?.agencyId ?? 0}-${user()?.id ?? 0}`;
    const legacyKey = () => `vitaltrek-evacuations-v1-${user()?.agencyId ?? 'anonymous'}`;
    const requestsKey = () => `vitaltrek-notification-requests-v1-${user()?.agencyId ?? 0}-${user()?.id ?? 0}`;

    /** Pending evacuation actions of the signed-in user, in capture order. */
    function outbox() { void revision.value; return readLocal(outboxKey(), []); }
    /** Actions queued by the simulated TB1 version; they reference simulated incidents and are never sent. */
    function legacyOutbox() { void revision.value; return readLocal(legacyKey(), []); }
    function saveOutbox(records) { writeLocal(outboxKey(), records); revision.value += 1; }
    /** Notification requests whose answer has not been received, by incident. */
    /**
     * Requests still waiting for an answer, kept by incident and then by recipient: one incident can lose the answer
     * of several recipients at once, and each of them has to keep its own identity. Entries written by the previous
     * version, which kept a single recipient per incident, are read in the current shape.
     */
    function pendingRequestsByRecipient() {
        void revision.value;
        const stored = readLocal(requestsKey(), {});
        const requests = {};
        for (const [incidentId, entry] of Object.entries(stored ?? {})) {
            if (!entry || typeof entry !== 'object') continue;
            requests[incidentId] = entry.notificationId && entry.recipient
                ? { [entry.recipient]: entry.notificationId } : { ...entry };
        }
        return requests;
    }

    /** Oldest request of each incident still waiting for an answer, which is the one the view offers to retry. */
    function pendingNotificationRequests() {
        const requests = {};
        for (const [incidentId, byRecipient] of Object.entries(pendingRequestsByRecipient())) {
            const [recipient, notificationId] = Object.entries(byRecipient)[0] ?? [];
            if (recipient) requests[incidentId] = { notificationId, recipient };
        }
        return requests;
    }
    function saveRequests(requests) { writeLocal(requestsKey(), requests); revision.value += 1; }

    /** Translates a coded refusal of the API into its i18n key; other failures keep their HTTP meaning. */
    async function call(request) {
        try { return await request(); }
        catch (cause) {
            const key = toIncidentErrorKey(cause);
            if (key) throw new ApplicationError(key);
            throw cause;
        }
    }

    function isStaff() { return [Roles.ADMIN, Roles.GUIDE].includes(user()?.role); }
    function authorize(group) {
        requireCondition(isStaff() && canAccessGroup(user(), group), 'workflow.errors.forbidden');
    }
    function upsert(incident) {
        if (!incident) return null;
        incidents.value = [...incidents.value.filter((item) => item.id !== incident.id), incident]
            .sort((first, second) => String(second.reportedAt).localeCompare(String(first.reportedAt)));
        return incident;
    }

    /** Loads the incidents of the tracking session of a group; without a session only the open incidents remain. */
    async function load(group, sessionId = null) {
        return state.run(async () => {
            if (!group || !isStaff()) { incidents.value = []; return []; }
            const response = await call(() => sessionId ? api.getIncidentsBySession(sessionId) : api.getOpenIncidents());
            const loaded = IncidentAssembler.toEntitiesFromResponse(response)
                .filter((incident) => incident.expeditionGroupId === group.id);
            incidents.value = [...incidents.value.filter((item) => item.expeditionGroupId !== group.id), ...loaded];
            return loaded;
        });
    }

    /** Restores incidents read from the offline workspace snapshot of the signed-in staff user. */
    function restore(cached = []) {
        incidents.value = (Array.isArray(cached) ? cached : []).filter((item) => item?.id).map((item) => new Incident(item));
    }

    /** Loads the persisted evacuation actions and, for administrators, the notifications of an incident. */
    async function loadDetails(incident) {
        return state.run(async () => {
            const actions = await call(() => api.getEvacuationActions(incident.id));
            evacuations.value = { ...evacuations.value, [incident.id]: EvacuationActionAssembler.toEntitiesFromResponse(actions) };
            if (user()?.role === Roles.ADMIN) {
                const sent = await call(() => api.getNotifications(incident.id));
                notifications.value = { ...notifications.value, [incident.id]: NotificationAssembler.toEntitiesFromResponse(sent) };
            }
        });
    }

    /** Reports an incident of the active session, manually or from one of its open alerts. */
    async function report(group, sessionId, { description, severity, type, alert = null }) {
        return state.run(async () => {
            authorize(group);
            requireCondition(Number.isInteger(sessionId) && sessionId > 0, 'incidents.errors.sessionRequired');
            const text = description?.trim() ?? '';
            requireCondition(text && text.length <= MAX_DESCRIPTION, 'workflow.errors.description');
            requireCondition(IncidentSeverities.includes(severity) && IncidentTypes.includes(type));
            if (alert) {
                requireCondition(alert.sessionId === sessionId && alert.expeditionGroupId === group.id,
                    'incidents.errors.alertOutsideSession');
                requireCondition(alert.status !== 'dismissed', 'incidents.errors.alertDismissed');
            }
            const response = await call(() => api.reportIncident(IncidentAssembler.toReportResource({
                sessionId, type, severity, description: text, alertId: alert?.id ?? null, reportedAt: new Date().toISOString(),
            })));
            return upsert(IncidentAssembler.toEntityFromResource(response.data));
        });
    }

    /** Asks the API for one explicit transition and replaces the incident with the answer. */
    async function transition(group, incident, action, note = '') {
        return state.run(async () => {
            requireCondition(incident.expeditionGroupId === group.id, 'workflow.errors.forbidden');
            requireCondition(incident.allows(action, user(), group), 'incidents.errors.transitionForbidden');
            requireCondition((note?.trim().length ?? 0) <= MAX_NOTE, 'workflow.errors.description');
            const response = await call(() => api.transition(incident.id, action, note?.trim() || null));
            return upsert(IncidentAssembler.toEntityFromResource(response.data));
        });
    }

    /**
     * Captures an evacuation action in the local queue with a stable client identity and the capture time. It works
     * offline; flushEvacuations sends it, and every retry reuses the same identity.
     */
    function recordEvacuation(group, incident, { description, location = '', status = 'in_progress' }) {
        const current = user();
        requireCondition(incident.expeditionGroupId === group.id && incident.canRecordEvacuation(current, group),
            'incidents.errors.evacuationForbidden');
        const text = description?.trim() ?? '', place = location?.trim() ?? '';
        requireCondition(text && text.length <= MAX_DESCRIPTION && place.length <= MAX_LOCATION, 'workflow.errors.description');
        requireCondition(EvacuationStatuses.includes(status));
        const clientActionId = crypto.randomUUID();
        const record = {
            id: clientActionId, clientActionId, kind: EvacuationRecordKind, agencyId: current.agencyId, userId: current.id,
            expeditionGroupId: group.id, sessionId: incident.sessionId, incidentId: incident.id, description: text,
            location: place, status, recordedAt: new Date().toISOString(), rejection: null,
        };
        saveOutbox([...outbox(), record]);
        return record;
    }

    /**
     * Sends the queued actions of a group, oldest first. Accepted or already persisted actions leave the queue; a
     * definitive refusal stays visible with its reason; a network failure, an expired session or a server error keeps
     * the rest of the queue untouched for the next attempt.
     */
    async function flushEvacuations(group) {
        return state.run(async () => {
            authorize(group);
            if (flushing) throw new ApplicationError('workflow.errors.syncInProgress');
            flushing = true;
            const result = { sent: 0, rejected: 0 };
            try {
                for (const record of outbox().filter((item) => item.expeditionGroupId === group.id && !item.rejection)) {
                    try {
                        const response = await api.recordEvacuationAction(record.incidentId, EvacuationActionAssembler.toResource(record));
                        const action = EvacuationActionAssembler.toEntityFromResource(response.data);
                        // Only an answer that returns the action with this same client identity proves that the API
                        // stored it. An empty body leaves the record queued, so the next attempt sends it again; the
                        // client identity makes that retry idempotent on the server.
                        if (!action || action.clientActionId !== record.clientActionId) continue;
                        const known = (evacuations.value[record.incidentId] ?? []).filter((item) => item.id !== action.id);
                        evacuations.value = { ...evacuations.value, [record.incidentId]: [...known, action] };
                        saveOutbox(outbox().filter((item) => item.id !== record.id));
                        result.sent += 1;
                    } catch (cause) {
                        const status = cause?.response?.status;
                        if (!FINAL_REFUSALS.has(status)) throw cause;
                        const code = toIncidentErrorKey(cause) ?? 'workflow.errors.invalid';
                        saveOutbox(outbox().map((item) => item.id === record.id ? { ...item, rejection: { code, status } } : item));
                        result.rejected += 1;
                    }
                }
            } finally { flushing = false; }
            return result;
        });
    }

    /** Removes a refused action from the queue after the guide read its reason. */
    function discardRejectedEvacuation(recordId) {
        saveOutbox(outbox().filter((item) => !(item.id === recordId && item.rejection)));
    }

    function storeNotification(incidentId, notification) {
        if (!notification) return null;
        const known = (notifications.value[incidentId] ?? []).filter((item) => item.notificationId !== notification.notificationId);
        notifications.value = { ...notifications.value, [incidentId]: [...known, notification] };
        return notification;
    }

    /**
     * Requests an e-mail notification for a declared emergency. The identity is stored before the request, so repeating
     * it after a lost answer reuses the same notificationId and the provider never sends a second message.
     */
    async function requestNotification(group, incident, recipient) {
        return state.run(async () => {
            authorize(group);
            requireCondition(incident.canNotify(user()), 'incidents.errors.notificationForbidden');
            const address = recipient?.trim().toLowerCase() ?? '';
            requireCondition(EMAIL.test(address), 'incidents.errors.notificationInvalid');
            const requests = pendingRequestsByRecipient();
            const forIncident = requests[incident.id] ?? {};
            const notificationId = forIncident[address] ?? crypto.randomUUID();
            saveRequests({ ...requests, [incident.id]: { ...forIncident, [address]: notificationId } });
            const response = await call(() => api.requestNotification(incident.id,
                { notificationId, recipientEmail: address, recipientType: 'agency_staff' }));
            // Only this recipient is answered; any other recipient of the same incident keeps its pending identity.
            const answered = pendingRequestsByRecipient();
            const { [address]: _sent, ...stillPending } = answered[incident.id] ?? {};
            if (Object.keys(stillPending).length) saveRequests({ ...answered, [incident.id]: stillPending });
            else { const { [incident.id]: _done, ...others } = answered; saveRequests(others); }
            return storeNotification(incident.id, NotificationAssembler.toEntityFromResource(response.data));
        });
    }

    /** Retries a pending notification with its persisted identity. */
    async function retryNotification(incident, notificationId) {
        return state.run(async () => {
            requireCondition(user()?.role === Roles.ADMIN, 'incidents.errors.notificationForbidden');
            const response = await call(() => api.retryNotification(incident.id, notificationId));
            return storeNotification(incident.id, NotificationAssembler.toEntityFromResource(response.data));
        });
    }

    /** Asks the server for the delivery state reported by the provider; the browser never sets it. */
    async function checkNotification(incident, notificationId) {
        return state.run(async () => {
            requireCondition(user()?.role === Roles.ADMIN, 'incidents.errors.notificationForbidden');
            const response = await call(() => api.checkNotification(incident.id, notificationId));
            return storeNotification(incident.id, NotificationAssembler.toEntityFromResource(response.data));
        });
    }

    return {
        incidents, evacuations, notifications, load, restore, loadDetails, report, transition, recordEvacuation,
        flushEvacuations, discardRejectedEvacuation, outbox, legacyOutbox, pendingNotificationRequests,
        requestNotification, retryNotification, checkNotification, pending: state.pending, error: state.error,
    };
});
