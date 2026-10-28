import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Incident } from '../domain/model/incident.entity.js';
import { IncidentResponseApi } from '../infrastructure/incident-response-api.js';
import { IncidentAssembler } from '../infrastructure/incident.assembler.js';
import { createActionState } from '../../shared/application/action-state.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import { readLocal, writeLocal } from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

const api = new IncidentResponseApi();
export default defineStore('incidentResponse', () => {
    const incidents = ref([]), notifications = ref([]), evacuations = ref([]), rescues = ref([]), revision = ref(0);
    const state = createActionState();
    const outboxKey = () => `vitaltrek-evacuations-v1-${useIamStore().user?.agencyId ?? 'anonymous'}`;
    function outbox() { void revision.value; return readLocal(outboxKey(), []); }
    function authorize(group, adminOnly = false) {
        const iam = useIamStore();
        requireCondition(canAccessGroup(iam.user, group) && (!adminOnly || iam.isAdmin), 'workflow.errors.forbidden');
    }
    async function load() {
        const [i, n, e, r] = await Promise.all([api.incidents.getAll(), api.notifications.getAll(), api.evacuations.getAll(), api.rescues.getAll()]);
        incidents.value = IncidentAssembler.toEntitiesFromResponse(i); notifications.value = n.data; evacuations.value = e.data; rescues.value = r.data;
    }
    async function declare(group, description, severity, alert = null) {
        return state.run(async () => {
            authorize(group);
            requireCondition(group.status === 'active', 'workflow.errors.notActive');
            requireCondition(description.trim() && ['low', 'medium', 'high', 'critical'].includes(severity), 'workflow.errors.description');
            if (alert) {
                requireCondition(alert.expeditionGroupId === group.id && ['active', 'acknowledged'].includes(alert.status));
                requireCondition(!incidents.value.some((i) => i.alertId === alert.id), 'workflow.errors.incidentExists');
            }
            const incident = new Incident({ expeditionGroupId: group.id, description: description.trim(), severity, alertId: alert?.id ?? null });
            const response = await api.incidents.create(incident);
            await load();
            return response.data;
        });
    }
    async function transition(group, incident, status, note) {
        return state.run(async () => {
            authorize(group, status === 'emergency_declared');
            requireCondition(incident.expeditionGroupId === group.id);
            const next = new Incident(incident).transition(status, note);
            await api.incidents.patch(incident.id, next);
            await load();
        });
    }
    async function notify(group, incident, recipient, channel) {
        return state.run(async () => {
            authorize(group, true);
            requireCondition(incident.expeditionGroupId === group.id && incident.status === 'emergency_declared');
            requireCondition(recipient.trim() && ['email', 'sms', 'phone'].includes(channel));
            await api.notifications.create({ incidentId: incident.id, expeditionGroupId: group.id, recipient: recipient.trim(), channel, status: 'simulated', recordedAt: new Date().toISOString() });
            await load();
        });
    }
    async function coordinate(group, incident, organization, phone, note) {
        return state.run(async () => {
            authorize(group, true);
            requireCondition(incident.expeditionGroupId === group.id && incident.status === 'emergency_declared' && organization.trim() && phone.trim() && note.trim());
            await api.rescues.create({ incidentId: incident.id, expeditionGroupId: group.id, organization: organization.trim(), phone: phone.trim(), note: note.trim(), status: 'requested', recordedAt: new Date().toISOString() });
            await load();
        });
    }
    function recordEvacuation(group, incident, note, location) {
        authorize(group);
        requireCondition(incident.expeditionGroupId === group.id && incident.status === 'emergency_declared' && note.trim() && location.trim());
        writeLocal(outboxKey(), [...outbox(), { id: crypto.randomUUID(), expeditionGroupId: group.id, incidentId: incident.id, note: note.trim(), location: location.trim(), recordedAt: new Date().toISOString(), agencyId: group.agencyId }]);
        revision.value += 1;
    }
    async function flushEvacuations(group) {
        return state.run(async () => {
            authorize(group);
            for (const item of outbox().filter((r) => r.expeditionGroupId === group.id)) {
                if (!(await api.evacuations.getAll({ id: item.id })).data.length) await api.evacuations.create({ ...item, synchronizedAt: new Date().toISOString() });
                writeLocal(outboxKey(), outbox().filter((r) => r.id !== item.id));
            }
            revision.value += 1;
            await load();
        });
    }
    return { incidents, notifications, evacuations, rescues, load, declare, transition, notify, coordinate, recordEvacuation, flushEvacuations, outbox, pending: state.pending, error: state.error };
});
