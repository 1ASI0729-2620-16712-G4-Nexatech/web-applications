import { ref } from 'vue';
import { defineStore } from 'pinia';
import { PreparationApi } from '../infrastructure/preparation-api.js';
import { ParticipantPreparationAssembler as Assembler } from '../infrastructure/participant-preparation.assembler.js';
import { MAX_HEALTH_NOTES } from '../domain/model/participant-preparation.entity.js';
import { FieldGuideAssembler } from '../infrastructure/field-guide.assembler.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import { createActionState } from '../../shared/application/action-state.js';

const api = new PreparationApi();
export default defineStore('preparation', () => {
    const preparations = ref([]), wearables = ref([]), notes = ref([]), protocols = ref([]);
    const state = createActionState();
    async function load() {
        return state.run(async () => {
            // The wearable inventory is only exposed to operations staff.
            const readsWearables = useIamStore().user?.role !== Roles.TOURIST;
            const [p, w, n, s] = await Promise.all([api.preparations.getAll(), readsWearables ? api.wearables.getAll() : Promise.resolve({ data: [] }), api.notes.getAll(), api.protocols.getAll()]);
            preparations.value = Assembler.toEntitiesFromResponse(p); wearables.value = w.data; notes.value = n.data; protocols.value = s.data;
        });
    }
    function forMember(memberId) { return preparations.value.find((p) => p.memberId === memberId); }
    async function saveParticipant(group, member, changes, members) {
        return state.run(async () => {
            const iam = useIamStore();
            requireCondition(canAccessGroup(iam.user, group, members), 'workflow.errors.forbidden');
            requireCondition(member.expeditionGroupId === group.id && group.status !== 'finished');
            const current = forMember(member.id);
            requireCondition(current, 'workflow.errors.preparation');
            if (iam.user.role === Roles.TOURIST) {
                requireCondition(member.identityDocument === iam.user.identityDocument, 'workflow.errors.forbidden');
                const contact = { name: changes.emergencyContact?.name?.trim(), phone: changes.emergencyContact?.phone?.trim(), relationship: changes.emergencyContact?.relationship?.trim() || null };
                requireCondition(contact.name && contact.phone, 'workflow.errors.consent');
                requireCondition(!changes.consent || current.wearableId, 'workflow.errors.wearable');
                await api.registerEmergencyContact(current.id, contact);
                // Granting consent activates the assigned wearable in the API.
                if (changes.consent !== current.consent) await api.updateConsent(current.id, changes.consent);
            } else {
                requireCondition(group.status === 'scheduled', 'workflow.errors.started');
                requireCondition(wearables.value.some((w) => w.id === changes.wearableId && (w.status === 'available' || w.id === current.wearableId)), 'workflow.errors.wearable');
                await api.assignWearable(current.id, changes.wearableId);
            }
            await load();
            return forMember(member.id);
        });
    }
    /** The tourist saves or clears its own optional health information; nobody else can edit it. */
    async function saveHealthInformation(group, member, healthNotes) {
        return state.run(async () => {
            const iam = useIamStore();
            requireCondition(iam.user?.role === Roles.TOURIST && member.identityDocument === iam.user.identityDocument
                && member.expeditionGroupId === group.id, 'workflow.errors.forbidden');
            requireCondition(group.status !== 'finished', 'workflow.errors.started');
            const current = forMember(member.id);
            requireCondition(current, 'workflow.errors.preparation');
            const notes = healthNotes?.trim() ?? '';
            requireCondition(notes.length <= MAX_HEALTH_NOTES, 'healthInformation.tooLong');
            const response = await api.registerHealthInformation(current.id, notes || null);
            const updated = Assembler.toEntityFromResource(response.data);
            preparations.value = preparations.value.map((preparation) => preparation.id === updated.id ? updated : preparation);
            return updated;
        });
    }
    async function saveRouteContent(routeId, note, instructions) {
        return state.run(async () => {
            requireCondition(useIamStore().isAdmin, 'workflow.errors.forbidden');
            requireCondition(note.trim() && instructions.trim());
            const existing = protocols.value.find((p) => p.routeId === routeId);
            if (existing) await api.protocols.update(existing.id, { instructions: instructions.trim(), status: 'active' });
            else await api.protocols.create({ routeId, instructions: instructions.trim() });
            const existingNote = notes.value.find((n) => n.routeId === routeId);
            if (existingNote) await api.notes.update(existingNote.id, { title: existingNote.title, content: note.trim(), displayOrder: existingNote.displayOrder });
            else await api.notes.create({ routeId, title: 'Route notes', content: note.trim(), displayOrder: 1 });
            await load();
        });
    }
    /** Registers a guide profile; the API assigns the next operational code when none is given. */
    async function createGuide(name, code = '') {
        requireCondition(useIamStore().isAdmin, 'workflow.errors.forbidden');
        requireCondition(name?.trim(), 'workflow.errors.invalid');
        const operationalCode = code?.trim().toUpperCase() ?? '';
        requireCondition(!operationalCode || /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(operationalCode), 'guideAccounts.invalidCode');
        const response = await api.guides.create({ name: name.trim(), ...(operationalCode ? { code: operationalCode } : {}) });
        return FieldGuideAssembler.toEntityFromResource(response.data);
    }
    return { preparations, wearables, notes, protocols, forMember, load, saveParticipant, saveHealthInformation, saveRouteContent, createGuide, pending: state.pending, error: state.error };
});
