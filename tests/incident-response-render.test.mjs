import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createViteServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createSSRApp, computed, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPinia } from 'pinia';

function memoryStorage() {
    const values = new Map();
    return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) };
}

test('the incident panel, the health form and the accounts view render translated for each role and state', async (t) => {
    const vite = await createViteServer({ configFile: false, plugins: [vue()], appType: 'custom', logLevel: 'error', server: { middlewareMode: true, watch: null, ws: false } });
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.document = { documentElement: {} };
    t.after(() => vite.close());
    const load = (p) => vite.ssrLoadModule(p);
    const [i18nModule, session, panel, healthForm, accounts, incidentStore, safetyStore, prepStore, assembler, prepEntity, users] = await Promise.all([
        load('/src/i18n.js'), load('/src/iam/infrastructure/iam-session.js'),
        load('/src/incident-response/presentation/components/IncidentPanel.vue'),
        load('/src/expedition-setup/presentation/components/ParticipantHealthForm.vue'),
        load('/src/iam/presentation/views/AccountsView.vue'),
        load('/src/incident-response/application/incident-response.store.js'),
        load('/src/safety-monitoring/application/safety-monitoring.store.js'),
        load('/src/expedition-setup/application/preparation.store.js'),
        load('/src/incident-response/infrastructure/incident.assembler.js'),
        load('/src/expedition-setup/domain/model/participant-preparation.entity.js'),
        load('/src/iam/domain/user.entity.js'),
    ]);
    const group = ref({ id: 101, agencyId: 4, fieldGuideId: 7, status: 'active' });
    for (const role of [users.Roles.ADMIN, users.Roles.GUIDE]) {
        session.saveSession({ user: { id: 5, agencyId: 4, fieldGuideId: role === users.Roles.GUIDE ? 7 : null, role }, token: 't', expiresAt: Date.now() + 60_000 });
        for (const status of ['reported', 'confirmed', 'emergency_declared', 'resolved', 'dismissed']) {
            const pinia = createPinia();
            const app = createSSRApp(panel.default);
            app.use(pinia); app.use(i18nModule.default);
            const incidents = incidentStore.default(pinia);
            incidents.incidents = [assembler.IncidentAssembler.toEntityFromResource({ id: 41, sessionId: 42, expeditionGroupId: 101, agencyId: 4, reportedAt: '2026-11-27T14:00:00Z', incidentType: 'medical', severity: 'high', description: 'Test', status, emergencyDeclaredAt: status === 'emergency_declared' ? '2026-11-27T14:05:00Z' : null, statusChanges: [{ toStatus: 'reported', actorUserId: 5, occurredAt: '2026-11-27T14:00:00Z' }] })];
            const iam = { user: { id: 5, agencyId: 4, fieldGuideId: role === users.Roles.GUIDE ? 7 : null, role }, isAdmin: role === users.Roles.ADMIN };
            app.provide('expedition-workspace', { group, iam, safety: safetyStore.default(pinia), incidents, tracking: { entries: { 101: { session: { sessionId: 42, status: 'active' } } } }, protocol: computed(() => ({ instructions: 'Call base.' })) });
            const html = await renderToString(app);
            assert.match(html, /vt-panel/);
            assert.doesNotMatch(html, /incidents\.[a-zA-Z]+\.[a-zA-Z_]+/, `untranslated key for ${role} ${status}`);
        }
    }
    session.saveSession({ user: { id: 6, agencyId: 4, role: users.Roles.TOURIST, identityDocument: 'DOC-0' }, token: 't', expiresAt: Date.now() + 60_000 });
    const pinia = createPinia();
    const prep = prepStore.default(pinia);
    prep.preparations = [new prepEntity.ParticipantPreparation({ id: 80, expeditionGroupId: 101, memberId: 60, agencyId: 4, healthNotes: 'Asthma' })];
    const healthApp = createSSRApp(healthForm.default, { group: group.value, member: { id: 60, expeditionGroupId: 101, identityDocument: 'DOC-0' } });
    healthApp.use(pinia); healthApp.use(i18nModule.default);
    const healthHtml = await renderToString(healthApp);
    assert.match(healthHtml, /Asthma/);

    session.saveSession({ user: { id: 5, agencyId: 4, role: users.Roles.ADMIN }, token: 't', expiresAt: Date.now() + 60_000 });
    const accountsApp = createSSRApp(accounts.default);
    accountsApp.use(createPinia()); accountsApp.use(i18nModule.default);
    const accountsHtml = await renderToString(accountsApp);
    assert.match(accountsHtml, /vt-panel/);
    assert.doesNotMatch(accountsHtml, /guideAccounts\.[a-zA-Z]+/);
});
