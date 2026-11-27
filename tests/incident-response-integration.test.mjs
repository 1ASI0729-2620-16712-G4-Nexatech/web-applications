import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia } from 'pinia';
import { createServer as createViteServer } from 'vite';

function memoryStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
    };
}

const group = { id: 101, agencyId: 4, fieldGuideId: 7, status: 'active' };

function incidentResource(overrides = {}) {
    return {
        id: 41, sessionId: 42, expeditionGroupId: 101, agencyId: 4, alertId: null, reportedByUserId: 5,
        reportedAt: '2026-11-27T14:00:00+00:00', incidentType: 'accident', severity: 'high',
        description: 'Fall near checkpoint 2.', status: 'reported', isOpen: true, confirmedAt: null, dismissedAt: null,
        emergencyDeclaredAt: null, resolvedAt: null, closedAt: null,
        statusChanges: [{ fromStatus: null, toStatus: 'reported', actorUserId: 5, note: null, occurredAt: '2026-11-27T14:00:00+00:00' }],
        ...overrides,
    };
}

/**
 * Vite SSR over a local HTTP double of /api/v1/incidents and /api/v1/participant-preparations. The double keeps one
 * evacuation action per clientActionId and one notification per notificationId, like the RESTful API, can drop the
 * connection to simulate a lost network, and records every request.
 */
async function startHarness(t) {
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.document = { documentElement: {} };
    const harness = {
        requests: [], incidents: new Map([[41, incidentResource()]]), actions: new Map(), notifications: new Map(),
        offline: false, loseNextResponse: false, nextActionId: 1, notificationMode: 'accept',
    };
    const server = createHttpServer(async (request, response) => {
        let body = '';
        for await (const piece of request) body += piece;
        const payload = body ? JSON.parse(body) : null;
        harness.requests.push({ method: request.method, url: request.url, body: payload });
        if (harness.offline) return request.socket.destroy();
        let lose = harness.loseNextResponse;
        harness.loseNextResponse = false;
        const reply = (status, data) => {
            if (lose) return request.socket.destroy();
            response.writeHead(status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(data));
        };
        if (!request.headers.authorization?.startsWith('Bearer ')) return reply(401, {});
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/api/v1/incidents')
            return reply(200, [...harness.incidents.values()].filter((item) => !url.searchParams.get('sessionId')
                || item.sessionId === Number(url.searchParams.get('sessionId'))));
        if (request.method === 'POST' && url.pathname === '/api/v1/incidents') {
            if (payload.alertId === 77) return reply(409, { title: 'Linked', code: 'Incident.AlertAlreadyLinked' });
            const created = incidentResource({ id: 50 + harness.incidents.size, alertId: payload.alertId ?? null,
                description: payload.description, incidentType: payload.incidentType, severity: payload.severity });
            harness.incidents.set(created.id, created);
            return reply(201, created);
        }
        const transition = url.pathname.match(/^\/api\/v1\/incidents\/(\d+)\/(confirm|dismiss|declare-emergency|resolve|close)$/);
        if (request.method === 'PATCH' && transition) {
            const targets = { confirm: 'confirmed', dismiss: 'dismissed', 'declare-emergency': 'emergency_declared', resolve: 'resolved', close: 'closed' };
            const current = harness.incidents.get(Number(transition[1]));
            const status = targets[transition[2]];
            const updated = { ...current, status, emergencyDeclaredAt: status === 'emergency_declared' ? '2026-11-27T14:10:00+00:00' : current.emergencyDeclaredAt,
                statusChanges: [...current.statusChanges, { fromStatus: current.status, toStatus: status, actorUserId: 5, note: payload?.note ?? null, occurredAt: '2026-11-27T14:10:00+00:00' }] };
            harness.incidents.set(updated.id, updated);
            return reply(200, updated);
        }
        const actions = url.pathname.match(/^\/api\/v1\/incidents\/(\d+)\/evacuation-actions$/);
        if (actions && request.method === 'GET')
            return reply(200, [...harness.actions.values()].filter((item) => item.incidentId === Number(actions[1])));
        if (actions && request.method === 'POST') {
            const existing = harness.actions.get(payload.clientActionId);
            if (existing && existing.description !== payload.description)
                return reply(409, { title: 'Conflict', code: 'EvacuationAction.IdentityConflict' });
            if (existing) return reply(200, existing);
            const stored = { id: harness.nextActionId++, incidentId: Number(actions[1]), expeditionGroupId: 101, recordedByUserId: 5,
                synchronizedAt: new Date().toISOString(), ...payload };
            harness.actions.set(payload.clientActionId, stored);
            return reply(201, stored);
        }
        const notifications = url.pathname.match(/^\/api\/v1\/incidents\/(\d+)\/notifications(?:\/([0-9a-f-]+)\/(attempts|status-checks))?$/);
        if (notifications && request.method === 'GET')
            return reply(200, [...harness.notifications.values()].filter((item) => item.incidentId === Number(notifications[1])));
        if (notifications && request.method === 'POST') {
            if (notifications[3] === 'status-checks') {
                const item = { ...harness.notifications.get(notifications[2]), status: 'delivered', deliveredAt: '2026-11-27T14:20:00+00:00' };
                harness.notifications.set(item.notificationId, item);
                return reply(200, item);
            }
            if (notifications[3] === 'attempts') {
                const item = { ...harness.notifications.get(notifications[2]), status: 'accepted', attemptCount: 2 };
                harness.notifications.set(item.notificationId, item);
                return reply(200, item);
            }
            const existing = harness.notifications.get(payload.notificationId);
            const item = existing ?? { notificationId: payload.notificationId, incidentId: Number(notifications[1]),
                recipientEmail: payload.recipientEmail, status: harness.notificationMode === 'pending' ? 'pending' : 'accepted',
                requestedAt: '2026-11-27T14:15:00+00:00', attemptCount: 1, lastErrorCode: harness.notificationMode === 'pending' ? 'provider_not_configured' : null,
                deliveredAt: null };
            harness.notifications.set(item.notificationId, item);
            return reply(existing ? 200 : 201, item);
        }
        const health = url.pathname.match(/^\/api\/v1\/participant-preparations\/(\d+)\/health-information$/);
        if (health && request.method === 'PUT')
            return reply(200, { id: Number(health[1]), agencyId: 4, expeditionGroupId: 101, memberId: 60, consent: true, activated: true,
                emergencyContact: { name: 'Contact', phone: '+51987654321' }, baselineMin: 50, baselineMax: 140,
                healthNotes: payload.healthNotes, healthNotesRecordedAt: '2026-11-27T14:30:00+00:00', ready: true });
        if (request.method === 'POST' && url.pathname === '/api/v1/field-guides')
            return reply(201, { id: 9, agencyId: 4, name: payload.name, code: payload.code ?? 'GU-003' });
        return reply(404, {});
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const priorApiUrl = process.env.VITE_VITALTREK_API_URL;
    process.env.VITE_VITALTREK_API_URL = `http://127.0.0.1:${server.address().port}/api/v1`;
    let vite;
    t.after(async () => {
        try { await vite?.close(); }
        finally {
            await new Promise((resolve) => server.close(resolve));
            if (priorApiUrl === undefined) delete process.env.VITE_VITALTREK_API_URL;
            else process.env.VITE_VITALTREK_API_URL = priorApiUrl;
        }
    });
    vite = await createViteServer({
        configFile: false, appType: 'custom', logLevel: 'error',
        server: { middlewareMode: true, watch: null, ws: false },
    });
    const load = (path) => vite.ssrLoadModule(path);
    const [incidentStore, session, users, assembler, preparationStore, preparationEntity, guideEntity, onboarding] = await Promise.all([
        load('/src/incident-response/application/incident-response.store.js'),
        load('/src/iam/infrastructure/iam-session.js'),
        load('/src/iam/domain/user.entity.js'),
        load('/src/incident-response/infrastructure/incident.assembler.js'),
        load('/src/expedition-setup/application/preparation.store.js'),
        load('/src/expedition-setup/domain/model/participant-preparation.entity.js'),
        load('/src/expedition-setup/domain/model/field-guide.entity.js'),
        load('/src/iam/application/guide-account-onboarding.js'),
    ]);
    Object.assign(harness, { assembler, Roles: users.Roles, ParticipantPreparation: preparationEntity.ParticipantPreparation,
        FieldGuide: guideEntity.FieldGuide, onboarding });
    /** A fresh page load signed in with the given role; local storage survives, like a browser reload. */
    harness.signIn = (role = users.Roles.GUIDE, extra = {}) => {
        session.saveSession({ user: { id: 5, agencyId: 4, fieldGuideId: role === users.Roles.GUIDE ? 7 : null, role, ...extra }, token: `${role}-test`, expiresAt: Date.now() + 60_000 });
        const pinia = createPinia();
        return { incidents: incidentStore.default(pinia), preparation: preparationStore.default(pinia) };
    };
    return harness;
}

test('the assembler maps the API codes explicitly, reads the legacy status and translates coded refusals', async (t) => {
    const { assembler } = await startHarness(t);
    const incident = assembler.IncidentAssembler.toEntityFromResource(incidentResource({ status: 'in_response' }));
    assert.equal(incident.status, 'confirmed');
    assert.equal(incident.type, 'accident');
    assert.equal(incident.isOpen, true);
    assert.equal(assembler.IncidentAssembler.toEntityFromResource(incidentResource({ status: 'teleported' })), null);
    assert.equal(assembler.IncidentAssembler.toEntityFromResource(incidentResource({ incidentType: 'alien' })), null);
    assert.equal(assembler.toIncidentErrorKey({ response: { data: { code: 'Incident.AlertOutsideSession' } } }), 'incidents.errors.alertOutsideSession');
    assert.equal(assembler.toIncidentErrorKey({ response: { data: 'plain text' } }), null);
    const notification = assembler.NotificationAssembler.toEntityFromResource({ notificationId: 'a', status: 'accepted', deliveredAt: null });
    assert.equal(notification.status, 'accepted');
    assert.equal(notification.deliveredAt, null);
});

test('actions follow the role: the guide confirms, only the administrator declares the emergency, tourists read nothing', async (t) => {
    const harness = await startHarness(t);
    const { incidents } = harness.signIn(harness.Roles.GUIDE);
    await incidents.load(group, 42);
    let incident = incidents.incidents.find((item) => item.id === 41);
    assert.deepEqual(incident.availableActions({ id: 5, agencyId: 4, role: harness.Roles.GUIDE, fieldGuideId: 7 }, group), ['confirm', 'dismiss']);
    incident = await incidents.transition(group, incident, 'confirm', 'Verified');
    assert.equal(incident.status, 'confirmed');
    const before = harness.requests.length;
    await assert.rejects(incidents.transition(group, incident, 'declareEmergency'), { code: 'incidents.errors.transitionForbidden' });
    assert.equal(harness.requests.length, before, 'a forbidden action is not even sent');

    const admin = harness.signIn(harness.Roles.ADMIN).incidents;
    await admin.load(group, 42);
    await assert.rejects(admin.transition(group, admin.incidents.find((item) => item.id === 41), 'confirm'),
        { code: 'incidents.errors.transitionForbidden' });
    const declared = await admin.transition(group, admin.incidents.find((item) => item.id === 41), 'declareEmergency');
    assert.equal(declared.status, 'emergency_declared');
    assert.equal(harness.requests.at(-1).url, '/api/v1/incidents/41/declare-emergency');

    const tourist = harness.signIn(harness.Roles.TOURIST, { identityDocument: 'DOC-0' }).incidents;
    const requests = harness.requests.length;
    assert.deepEqual(await tourist.load(group, 42), []);
    assert.equal(harness.requests.length, requests);
});

test('reports keep alerts of the same session only and translate the refusal of the server', async (t) => {
    const harness = await startHarness(t);
    const { incidents } = harness.signIn(harness.Roles.GUIDE);
    const report = { description: 'Heart rate alert verified.', severity: 'high', type: 'medical' };
    await assert.rejects(incidents.report(group, 42, { ...report, alert: { id: 31, sessionId: 99, expeditionGroupId: 101, status: 'active' } }),
        { code: 'incidents.errors.alertOutsideSession' });
    await assert.rejects(incidents.report(group, 42, { ...report, alert: { id: 77, sessionId: 42, expeditionGroupId: 101, status: 'active' } }),
        { code: 'incidents.errors.alertAlreadyLinked' });
    await assert.rejects(incidents.report(group, null, report), { code: 'incidents.errors.sessionRequired' });
    const manual = await incidents.report(group, 42, report);
    assert.equal(manual.alertId, null);
    const sent = harness.requests.find((request) => request.method === 'POST' && request.body?.description === 'Heart rate alert verified.' && !request.body.alertId);
    assert.equal(sent.body.sessionId, 42);
    assert.equal('agencyId' in sent.body, false, 'the agency is resolved by the server');
});

test('an offline evacuation action survives a reload and two retries persist it once with its capture time', async (t) => {
    const harness = await startHarness(t);
    harness.incidents.set(41, incidentResource({ status: 'emergency_declared', emergencyDeclaredAt: '2026-11-27T14:10:00+00:00' }));
    let { incidents } = harness.signIn(harness.Roles.GUIDE);
    await incidents.load(group, 42);
    harness.offline = true;
    const queued = incidents.recordEvacuation(group, incidents.incidents[0], { description: 'Group moved to the shelter.', location: 'Checkpoint 3' });
    await assert.rejects(incidents.flushEvacuations(group));
    assert.equal(incidents.outbox().length, 1);

    // Reload: a new store reads the same queue from local storage.
    ({ incidents } = harness.signIn(harness.Roles.GUIDE));
    assert.equal(incidents.outbox()[0].clientActionId, queued.clientActionId);
    assert.equal(incidents.outbox()[0].recordedAt, queued.recordedAt);
    harness.offline = false;
    harness.loseNextResponse = true;
    await assert.rejects(incidents.flushEvacuations(group));
    assert.equal(incidents.outbox().length, 1, 'a lost answer keeps the action queued');
    const result = await incidents.flushEvacuations(group);

    assert.equal(result.sent, 1);
    assert.equal(incidents.outbox().length, 0);
    assert.equal(harness.actions.size, 1);
    const stored = harness.actions.get(queued.clientActionId);
    assert.equal(stored.recordedAt, queued.recordedAt);
    const posts = harness.requests.filter((request) => request.method === 'POST' && request.url.endsWith('/evacuation-actions'));
    assert.ok(posts.length >= 2);
    assert.ok(posts.every((request) => request.body.clientActionId === queued.clientActionId));
});

test('a refused evacuation action stays visible with its reason while the others are sent', async (t) => {
    const harness = await startHarness(t);
    harness.incidents.set(41, incidentResource({ status: 'emergency_declared', emergencyDeclaredAt: '2026-11-27T14:10:00+00:00' }));
    const { incidents } = harness.signIn(harness.Roles.GUIDE);
    await incidents.load(group, 42);
    const conflicting = incidents.recordEvacuation(group, incidents.incidents[0], { description: 'Original text.' });
    harness.actions.set(conflicting.clientActionId, { id: 99, clientActionId: conflicting.clientActionId, description: 'Different text', status: 'in_progress' });
    incidents.recordEvacuation(group, incidents.incidents[0], { description: 'Descent completed.', status: 'completed' });

    const result = await incidents.flushEvacuations(group);

    assert.deepEqual(result, { sent: 1, rejected: 1 });
    const [kept] = incidents.outbox();
    assert.equal(kept.clientActionId, conflicting.clientActionId);
    assert.equal(kept.rejection.code, 'incidents.errors.evacuationConflict');
    assert.equal(kept.kind, 'evacuation-action');
    incidents.discardRejectedEvacuation(kept.id);
    assert.equal(incidents.outbox().length, 0);
});

test('a notification request keeps its identity after a lost answer; accepted and delivered stay distinct', async (t) => {
    const harness = await startHarness(t);
    harness.incidents.set(41, incidentResource({ status: 'emergency_declared', emergencyDeclaredAt: '2026-11-27T14:10:00+00:00' }));
    const { incidents } = harness.signIn(harness.Roles.ADMIN);
    await incidents.load(group, 42);
    const incident = incidents.incidents[0];
    await assert.rejects(incidents.requestNotification(group, incident, 'not-an-address'), { code: 'incidents.errors.notificationInvalid' });

    harness.loseNextResponse = true;
    await assert.rejects(incidents.requestNotification(group, incident, 'Team-Test@VitalTrek.test'));
    const pending = incidents.pendingNotificationRequests()[41];
    assert.ok(pending.notificationId);
    const retried = await incidents.requestNotification(group, incident, 'team-test@vitaltrek.test');

    assert.equal(retried.notificationId, pending.notificationId);
    assert.equal(harness.notifications.size, 1);
    assert.equal(retried.status, 'accepted');
    assert.equal(retried.deliveredAt, null);
    assert.equal(incidents.pendingNotificationRequests()[41], undefined);
    const delivered = await incidents.checkNotification(incident, retried.notificationId);
    assert.equal(delivered.status, 'delivered');

    const guide = harness.signIn(harness.Roles.GUIDE).incidents;
    await guide.load(group, 42);
    await assert.rejects(guide.requestNotification(group, guide.incidents[0], 'team-test@vitaltrek.test'), { code: 'incidents.errors.notificationForbidden' });
});

test('a tourist edits only its own health information and it never reaches local snapshots', async (t) => {
    const harness = await startHarness(t);
    const { preparation } = harness.signIn(harness.Roles.TOURIST, { identityDocument: 'DOC-0' });
    preparation.preparations = [
        new harness.ParticipantPreparation({ id: 80, expeditionGroupId: 101, memberId: 60, agencyId: 4 }),
        new harness.ParticipantPreparation({ id: 81, expeditionGroupId: 101, memberId: 61, agencyId: 4 }),
    ];
    const own = { id: 60, expeditionGroupId: 101, identityDocument: 'DOC-0' };
    const other = { id: 61, expeditionGroupId: 101, identityDocument: 'DOC-1' };

    const saved = await preparation.saveHealthInformation(group, own, '  Allergic to penicillin. ');
    assert.equal(saved.healthNotes, 'Allergic to penicillin.');
    assert.equal(harness.requests.at(-1).url, '/api/v1/participant-preparations/80/health-information');
    const requests = harness.requests.length;
    await assert.rejects(preparation.saveHealthInformation(group, other, 'Injected'), { code: 'workflow.errors.forbidden' });
    await assert.rejects(preparation.saveHealthInformation(group, own, 'x'.repeat(501)), { code: 'healthInformation.tooLong' });
    assert.equal(harness.requests.length, requests);
    const snapshot = JSON.parse(JSON.stringify(preparation.preparations));
    assert.equal(snapshot[0].healthNotes, undefined);
    assert.equal(snapshot[0].emergencyContact.name, 'Contact');
});

test('a guide profile is created once and its account step can be retried; homonyms stay distinguishable', async (t) => {
    const harness = await startHarness(t);
    const { preparation } = harness.signIn(harness.Roles.ADMIN);
    const guide = await preparation.createGuide('Ana Quispe', '');
    assert.equal(guide.code, 'GU-003');
    await assert.rejects(preparation.createGuide('Ana Quispe', 'bad code!'), { code: 'guideAccounts.invalidCode' });
    const { onboarding, FieldGuide, Roles } = harness;
    onboarding.rememberGuideProfile(5, guide);
    assert.deepEqual(onboarding.pendingGuideProfile(5), { id: 9, name: 'Ana Quispe', code: 'GU-003' });
    const homonyms = [new FieldGuide({ id: 1, name: 'Ana Quispe', code: 'GU-001' }), guide];
    assert.notEqual(homonyms[0].label, homonyms[1].label);
    const users = [{ role: Roles.GUIDE, fieldGuideId: 1 }];
    assert.deepEqual(onboarding.guidesWithoutAccount(homonyms, users).map((item) => item.id), [9]);
    onboarding.forgetGuideProfile(5);
    assert.equal(onboarding.pendingGuideProfile(5), null);
    assert.equal(harness.requests.filter((request) => request.url === '/api/v1/field-guides').length, 1);
});

test('every incident, health and guide account text exists in English and Spanish', () => {
    const en = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url)));
    const es = JSON.parse(readFileSync(new URL('../src/locales/es.json', import.meta.url)));
    const keys = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]);
    for (const block of ['incidents', 'healthInformation', 'guideAccounts'])
        assert.deepEqual(keys(es[block]).sort(), keys(en[block]).sort(), block);
    for (const status of ['reported', 'confirmed', 'dismissed', 'emergency_declared', 'resolved', 'closed'])
        assert.ok(en.incidents.status[status] && es.incidents.status[status], status);
    for (const status of ['pending', 'accepted', 'delivered', 'failed'])
        assert.ok(en.incidents.notificationStatus[status] && es.incidents.notificationStatus[status], status);
    const errorKeys = readFileSync(new URL('../src/incident-response/infrastructure/incident.assembler.js', import.meta.url), 'utf8')
        .match(/'incidents\.errors\.[a-zA-Z]+'/g).map((key) => key.slice(1, -1).split('.').pop());
    for (const key of errorKeys) assert.ok(en.incidents.errors[key] && es.incidents.errors[key], key);
    for (const text of [JSON.stringify(en.incidents), JSON.stringify(es.incidents)])
        assert.equal(/[@|]/.test(text), false, 'vue-i18n reserves @ and |');
});
