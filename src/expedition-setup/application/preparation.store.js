import { ref } from 'vue';
import { defineStore } from 'pinia';
import { PreparationApi } from '../infrastructure/preparation-api.js';
import { ParticipantPreparationAssembler as Assembler } from '../infrastructure/participant-preparation.assembler.js';
import { ParticipantPreparation } from '../domain/model/participant-preparation.entity.js';
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
            const [p, w, n, s] = await Promise.all([api.preparations.getAll(), api.wearables.getAll(), api.notes.getAll(), api.protocols.getAll()]);
            preparations.value = Assembler.toEntitiesFromResponse(p); wearables.value = w.data; notes.value = n.data; protocols.value = s.data;
        });
    }
    function forMember(memberId) { return preparations.value.find((p) => p.memberId === memberId); }
    async function saveParticipant(group, member, changes, members) {
        return state.run(async () => {
            const iam = useIamStore();
            requireCondition(canAccessGroup(iam.user, group, members), 'workflow.errors.forbidden');
            requireCondition(member.expeditionGroupId === group.id && group.status !== 'finished');
            const own = iam.user.role === Roles.TOURIST;
            requireCondition(!own || member.identityDocument === iam.user.identityDocument, 'workflow.errors.forbidden');
            const current = forMember(member.id);
            const allowed = own ? { consent: changes.consent, emergencyContact: changes.emergencyContact, activated: changes.activated } : { wearableId: changes.wearableId };
            const entity = new ParticipantPreparation({ ...current, ...allowed, memberId: member.id, expeditionGroupId: group.id });
            if (own) {
                entity.validateConsent();
                requireCondition(!entity.activated || entity.wearableId, 'workflow.errors.wearable');
            } else {
                requireCondition(group.status !== 'active', 'workflow.errors.started');
                requireCondition(wearables.value.some((w) => w.id === entity.wearableId && (w.status === 'available' || w.id === current?.wearableId)), 'workflow.errors.wearable');
                requireCondition(!preparations.value.some((p) => p.memberId !== member.id && p.wearableId === entity.wearableId && !p.returnedAt), 'workflow.errors.wearable');
                if (current?.wearableId !== entity.wearableId) entity.activated = false;
                entity.returnedAt = null;
                entity.returnCondition = null;
            }
            const response = current ? await api.preparations.patch(current.id, entity) : await api.preparations.create(entity);
            // The preparation record is the ownership source; device status follows it.
            if (!own) {
                await api.wearables.patch(entity.wearableId, { status: 'assigned' });
                if (current?.wearableId && current.wearableId !== entity.wearableId) await api.wearables.patch(current.wearableId, { status: 'available' });
            }
            await load();
            return Assembler.toEntityFromResource(response.data);
        });
    }
    async function saveRouteContent(routeId, note, instructions) {
        return state.run(async () => {
            requireCondition(useIamStore().isAdmin, 'workflow.errors.forbidden');
            requireCondition(note.trim() && instructions.trim());
            const existing = protocols.value.find((p) => p.routeId === routeId);
            const protocol = { routeId, instructions: instructions.trim(), status: 'active' };
            if (existing) await api.protocols.patch(existing.id, protocol); else await api.protocols.create(protocol);
            const existingNote = notes.value.find((n) => n.routeId === routeId);
            if (existingNote) await api.notes.patch(existingNote.id, { content: note.trim() });
            else await api.notes.create({ routeId, title: 'Route notes', content: note.trim(), displayOrder: 1 });
            await load();
        });
    }
    async function createGuide(name) {
        requireCondition(useIamStore().isAdmin && name.trim(), 'workflow.errors.forbidden');
        return api.guides.create({ name: name.trim() });
    }
    return { preparations, wearables, notes, protocols, forMember, load, saveParticipant, saveRouteContent, createGuide, pending: state.pending, error: state.error };
});
