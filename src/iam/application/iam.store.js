import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { IamApi } from '../infrastructure/iam-api.js';
import { UserAssembler } from '../infrastructure/user.assembler.js';
import { readSession, saveSession } from '../infrastructure/iam-session.js';
import { Roles } from '../domain/user.entity.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import { createActionState } from '../../shared/application/action-state.js';

const api = new IamApi();

export default defineStore('iam', () => {
    const session = ref(readSession());
    const users = ref([]);
    const state = createActionState();
    const user = computed(() => session.value?.user ?? null);
    const isSignedIn = computed(() => !!user.value && session.value.expiresAt > Date.now());
    const isAdmin = computed(() => user.value?.role === Roles.ADMIN);

    async function signIn(command) {
        return state.run(async () => {
            const resource = await api.signIn(command);
            requireCondition(resource, 'workflow.errors.credentials');
            session.value = { user: UserAssembler.toEntityFromResource(resource), token: `demo-${crypto.randomUUID()}`, expiresAt: Date.now() + 12 * 3600000 };
            saveSession(session.value);
        });
    }
    function signOut() { saveSession(null); session.value = null; users.value = []; }
    async function signUp(command) {
        return state.run(async () => {
            requireCondition(command.agencyName && command.name && command.username && command.password.length >= 6);
            requireCondition(!(await api.findUsername(command.username)).data.length, 'workflow.errors.username');
            const agency = (await api.createAgency({ name: command.agencyName })).data;
            try { await api.createUser({ ...command, agencyName: undefined, agencyId: agency.id, role: Roles.ADMIN }); }
            catch (error) { await api.deleteAgency(agency.id); throw error; }
        });
    }
    async function fetchUsers() {
        requireCondition(isAdmin.value, 'workflow.errors.forbidden');
        users.value = UserAssembler.toEntitiesFromResponse(await api.getUsers(user.value.agencyId));
    }
    async function createAccount(resource) {
        return state.run(async () => {
            requireCondition(isAdmin.value, 'workflow.errors.forbidden');
            const username = resource.username.trim().toLowerCase();
            requireCondition(resource.name.trim() && username && resource.password.length >= 6);
            requireCondition([Roles.GUIDE, Roles.TOURIST].includes(resource.role));
            requireCondition(resource.role !== Roles.GUIDE || resource.fieldGuideId);
            requireCondition(resource.role !== Roles.TOURIST || resource.identityDocument?.trim());
            requireCondition(!(await api.findUsername(username)).data.length, 'workflow.errors.username');
            await fetchUsers();
            if (resource.role === Roles.GUIDE) {
                requireCondition((await api.getGuides(user.value.agencyId, resource.fieldGuideId)).data.length > 0, 'workflow.errors.forbidden');
                requireCondition(!users.value.some((u) => u.role === Roles.GUIDE && u.fieldGuideId === resource.fieldGuideId), 'workflow.errors.linkedIdentity');
            } else {
                requireCondition((await api.getManifest(user.value.agencyId, resource.identityDocument.trim())).data.length > 0, 'workflow.errors.manifestIdentity');
                requireCondition(!users.value.some((u) => u.role === Roles.TOURIST && u.identityDocument === resource.identityDocument.trim()), 'workflow.errors.linkedIdentity');
            }
            await api.createUser({ ...resource, username, agencyId: user.value.agencyId });
            await fetchUsers();
        });
    }
    return { session, user, users, isSignedIn, isAdmin, pending: state.pending, error: state.error, signIn, signOut, signUp, fetchUsers, createAccount };
});
