import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { IamApi } from '../infrastructure/iam-api.js';
import { UserAssembler } from '../infrastructure/user.assembler.js';
import { readSession, saveSession, tokenExpiration } from '../infrastructure/iam-session.js';
import { Roles } from '../domain/user.entity.js';
import { ApplicationError, requireCondition } from '../../shared/domain/application-error.js';
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
            let response;
            try { response = await api.signIn(command); }
            catch (error) {
                if ([400, 401].includes(error.response?.status)) throw new ApplicationError('workflow.errors.credentials');
                throw error;
            }
            const { token, ...resource } = response.data;
            session.value = { user: UserAssembler.toEntityFromResource(resource), token, expiresAt: tokenExpiration(token) };
            saveSession(session.value);
        });
    }
    function signOut() { saveSession(null); session.value = null; users.value = []; }
    async function signUp(command) {
        return state.run(async () => {
            requireCondition(command.agencyName && command.name && command.username && command.password.length >= 6);
            try { await api.signUp(command); }
            catch (error) {
                if (error.response?.status === 409) throw new ApplicationError('workflow.errors.username');
                throw error;
            }
        });
    }
    async function fetchUsers() {
        requireCondition(isAdmin.value, 'workflow.errors.forbidden');
        users.value = UserAssembler.toEntitiesFromResponse(await api.getUsers());
    }
    async function createAccount(resource) {
        return state.run(async () => {
            requireCondition(isAdmin.value, 'workflow.errors.forbidden');
            const username = resource.username.trim().toLowerCase();
            const identityDocument = resource.identityDocument?.trim() || null;
            requireCondition(resource.name.trim() && username && resource.password.length >= 6);
            requireCondition([Roles.GUIDE, Roles.TOURIST].includes(resource.role));
            requireCondition(resource.role !== Roles.GUIDE || resource.fieldGuideId);
            requireCondition(resource.role !== Roles.TOURIST || identityDocument);
            await fetchUsers();
            requireCondition(!users.value.some((u) => u.username === username), 'workflow.errors.username');
            requireCondition(resource.role !== Roles.GUIDE || !users.value.some((u) => u.role === Roles.GUIDE && u.fieldGuideId === resource.fieldGuideId), 'workflow.errors.linkedIdentity');
            requireCondition(resource.role !== Roles.TOURIST || !users.value.some((u) => u.role === Roles.TOURIST && u.identityDocument === identityDocument), 'workflow.errors.linkedIdentity');
            await api.createUser({
                name: resource.name.trim(),
                username,
                password: resource.password,
                role: resource.role,
                fieldGuideId: resource.role === Roles.GUIDE ? resource.fieldGuideId : null,
                identityDocument: resource.role === Roles.TOURIST ? identityDocument : null,
            });
            await fetchUsers();
        });
    }
    return { session, user, users, isSignedIn, isAdmin, pending: state.pending, error: state.error, signIn, signOut, signUp, fetchUsers, createAccount };
});
