import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import jsonServer from 'json-server';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { isPastDate } from '../src/shared/domain/calendar-date.js';
import { TourClosure } from '../src/tour-closure/domain/model/tour-closure.entity.js';
import { evaluateSafety } from '../src/safety-monitoring/domain/model/safety-evaluation.js';

function memoryStorage() {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key), clear: () => values.clear() };
}
globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();

test('calendar dates accept today in Lima and reject invalid dates', () => {
    assert.equal(isPastDate('2026-10-25', '2026-10-25'), false);
    assert.equal(isPastDate('2026-10-24', '2026-10-25'), true);
    assert.equal(isPastDate('2026-02-30', '2026-01-01'), true);
    assert.equal(isPastDate('', '2026-10-25'), true);
});

test('delay evaluation uses capture times, including batches received later', () => {
    const segments = [{ fromCheckpoint: { id: 1 }, toCheckpoint: { id: 2 }, expectedTimeWindow: { maximumMinutes: 20 } }];
    const arrivals = [{ expeditionGroupId: 1, checkpointId: 1, recordedAt: '2026-10-25T10:00:00Z' }, { expeditionGroupId: 1, checkpointId: 2, recordedAt: '2026-10-25T10:10:00Z' }];
    assert.equal(evaluateSafety({ id: 1 }, [], arrivals, segments, [], Date.parse('2026-10-25T18:00:00Z')).length, 0);
    arrivals[1].recordedAt = '2026-10-25T10:30:00Z';
    assert.equal(evaluateSafety({ id: 1 }, [], arrivals, segments, []).at(0).type, 'delay');
});

test('closure blocks pending local data unless incompleteness is acknowledged', () => {
    const closure = new TourClosure({ id: 1 });
    assert.throws(() => closure.validate({ id: 1, status: 'active' }, [], [], [], [{ id: 'pending' }], { incomplete: false }), { code: 'workflow.errors.pendingSync' });
    assert.doesNotThrow(() => closure.validate({ id: 1, status: 'active' }, [], [], [], [{ id: 'pending' }], { incomplete: true }));
});

test('role, preparation, synchronization, incident and closure workflows against an isolated API', async (t) => {
    const db = JSON.parse(await readFile(new URL('../server/demo-seed.json', import.meta.url), 'utf8'));
    const app = jsonServer.create();
    let failReading = false;
    app.use(jsonServer.bodyParser);
    app.use(jsonServer.rewriter({ '/api/v1/*': '/$1' }));
    app.use((req, res, next) => {
        if (failReading && req.method === 'POST' && req.path === '/telemetry-records' && req.body.heartRate === 181) {
            failReading = false;
            return res.status(503).json({ error: 'Simulated interrupted upload' });
        }
        next();
    });
    const router = jsonServer.router(db);
    app.use(router);
    const http = await new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    process.env.VITE_VITALTREK_API_URL = `http://127.0.0.1:${http.address().port}/api/v1`;
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
    t.after(async () => { await vite.close(); await new Promise((resolve) => http.close(resolve)); delete process.env.VITE_VITALTREK_API_URL; });
    setActivePinia(createPinia());
    async function store(path) { return (await vite.ssrLoadModule(`/src/${path}`)).default(); }
    const iam = await store('iam/application/iam.store.js');
    const setup = await store('expedition-setup/application/expedition-setup.store.js');
    const prep = await store('expedition-setup/application/preparation.store.js');
    const execution = await store('field-tracking/application/expedition-execution.store.js');
    const sync = await store('checkpoint-sync/application/checkpoint-sync.store.js');
    const safety = await store('safety-monitoring/application/safety-monitoring.store.js');
    const incidents = await store('incident-response/application/incident-response.store.js');
    const closure = await store('tour-closure/application/tour-closure.store.js');
    const { authenticationGuard } = await vite.ssrLoadModule('/src/iam/infrastructure/authentication.guard.js');
    async function login(role) { iam.signOut(); await iam.signIn({ username: `${role}@vitaltrek.demo`, password: 'VitalTrek123!' }); }
    async function load() { await Promise.all([setup.fetchRoutes(), setup.fetchCheckpoints(), setup.fetchExpectedTimeWindows(), setup.fetchManifestEntries(), setup.fetchExpeditionGroups(), prep.load(), execution.load(), sync.load(), incidents.load(), closure.load()]); }
    let group, members, checkpoints, segments, route, protocol;
    await t.test('credentials, session persistence and route permissions', async () => {
        await assert.rejects(iam.signIn({ username: 'admin@vitaltrek.demo', password: 'wrong' }), { code: 'workflow.errors.credentials' });
        assert.equal(iam.isSignedIn, false);
        assert.deepEqual(await authenticationGuard({ meta: {}, params: {} }), { name: 'iam-sign-in' });
        await login('tourist');
        assert.equal(JSON.parse(sessionStorage.getItem('vitaltrek-demo-session')).user.role, 'adventure_tourist');
        assert.equal(await authenticationGuard({ meta: { roles: ['operations_administrator'] }, params: {} }), '/tourist/expedition');
        await login('guide');
        assert.deepEqual(await authenticationGuard({ meta: {}, params: { groupId: 2 } }), { name: 'forbidden' });
    });
    await t.test('agency filtering and registration produce isolated workspaces', async () => {
        await login('other');
        await setup.fetchRoutes(); assert.equal(setup.routes.length, 0);
        assert.deepEqual(await authenticationGuard({ meta: {}, params: { routeId: 1 } }), { name: 'forbidden' });
        await iam.signUp({ agencyName: 'Test Agency', name: 'Test Administrator', username: 'new@test.demo', password: 'demo123' });
        await iam.signIn({ username: 'new@test.demo', password: 'demo123' });
        await setup.fetchExpeditionGroups(); assert.equal(setup.expeditionGroups.length, 0);
    });
    await t.test('departure is blocked until all participants have consent and active devices', async () => {
        await login('guide'); await load();
        group = setup.expeditionGroups.find((g) => g.id === 1); members = setup.getManifestEntriesByGroupId(1); checkpoints = setup.getCheckpointsByRouteId(group.routeId); segments = setup.getRouteSegments(group.routeId); route = setup.routes.find((r) => r.id === group.routeId); protocol = prep.protocols.find((p) => p.routeId === group.routeId);
        await assert.rejects(execution.start(group, members, prep.preparations, route, protocol, segments), { code: 'workflow.errors.preparation' });
        await login('tourist');
        await assert.rejects(prep.saveParticipant(group, members[1], { consent: true }, members), { code: 'workflow.errors.forbidden' });
        await prep.saveParticipant(group, members[0], { consent: true, activated: true, emergencyContact: { name: 'Fictitious contact', phone: '000000000' } }, members);
        await login('guide');
        group = await execution.start(group, members, prep.preparations, route, protocol, segments);
        assert.equal(group.status, 'active');
        await assert.rejects(execution.start(group, members, prep.preparations, route, protocol, segments), { code: 'workflow.errors.started' });
    });
    await t.test('offline arrivals enforce order and readings persist in local storage', async () => {
        assert.throws(() => execution.checkIn(group, checkpoints[1], checkpoints), { code: 'workflow.errors.checkpointOrder' });
        execution.checkIn(group, checkpoints[0], checkpoints);
        for (const heartRate of [160, 181]) execution.capture(group, members[0], prep.forMember(members[0].id), { heartRate, battery: 90, latitude: -9.5, longitude: -77.5, deviationMeters: 150 }, members);
        assert.equal(execution.queue(group).length, 3);
        assert.equal(JSON.parse(localStorage.getItem('vitaltrek-queue-v1-1')).length, 3);
        assert.throws(() => execution.capture(group, members[0], prep.forMember(1), { heartRate: 80, battery: 200, latitude: 100, longitude: -77, deviationMeters: 0 }, members), { code: 'workflow.errors.invalid' });
    });
    await t.test('an interrupted batch retains records and retry avoids duplicate ingestion', async () => {
        failReading = true;
        await assert.rejects(sync.synchronize(group, checkpoints[0], checkpoints, members, prep.preparations));
        assert.equal(execution.queue(group).length, 3);
        await sync.synchronize(group, checkpoints[0], checkpoints, members, prep.preparations);
        assert.equal(execution.queue(group).length, 0);
        assert.equal(sync.telemetry.filter((r) => r.expeditionGroupId === 1).length, 2);
        assert.equal(sync.batches.find((b) => b.status === 'completed').duplicates, 2);
        assert.equal(router.db.get('group-progress').find({ expeditionGroupId: 1 }).value().estimatedProgressPercentage, Math.round(100 / checkpoints.length));
    });
    await t.test('risk evaluation is idempotent for open alerts and closed alerts remain closed', async () => {
        await execution.load();
        await safety.evaluate(group, sync.telemetry, execution.checkIns, segments, prep.preparations);
        const count = safety.getEarlyWarningAlertsByGroupId(1).length;
        assert.equal(count, 2);
        await safety.evaluate(group, sync.telemetry, execution.checkIns, segments, prep.preparations);
        assert.equal(safety.getEarlyWarningAlertsByGroupId(1).length, count);
        const alert = safety.getEarlyWarningAlertsByGroupId(1)[0];
        await safety.dismissAlertAsFalseAlarm(alert.id);
        assert.equal(await safety.acknowledgeAlert(alert.id), null);
        safety.clearErrors();
    });
    let incident;
    await t.test('incident confirmation, admin escalation and offline evacuation maintain history', async () => {
        await incidents.declare(group, 'Fictitious incident', 'high');
        incident = incidents.incidents.find((i) => i.expeditionGroupId === 1);
        await incidents.transition(group, incident, 'confirmed', 'Verified in field');
        incident = incidents.incidents.find((i) => i.id === incident.id);
        await assert.rejects(incidents.transition(group, incident, 'emergency_declared', 'Escalate'), { code: 'workflow.errors.forbidden' });
        await login('admin');
        await incidents.transition(group, incident, 'emergency_declared', 'Demonstration escalation');
        incident = incidents.incidents.find((i) => i.id === incident.id);
        await incidents.notify(group, incident, 'fictitious@example.invalid', 'email');
        assert.equal(incidents.notifications[0].status, 'simulated');
        await incidents.coordinate(group, incident, 'Fictitious rescue', '000', 'Demo request');
        await login('guide');
        incidents.recordEvacuation(group, incident, 'Movement logged offline', 'Demo checkpoint');
        const capturedAt = incidents.outbox()[0].recordedAt;
        await incidents.flushEvacuations(group);
        assert.equal(incidents.outbox().length, 0);
        assert.equal(incidents.evacuations[0].recordedAt, capturedAt);
    });
    await t.test('closure requires explicit incident acknowledgement and preserves device conditions', async () => {
        const returns = prep.preparations.filter((p) => p.expeditionGroupId === 1).map((p, i) => ({ wearableId: p.wearableId, condition: i === 0 ? 'maintenance' : i === 1 ? 'lost' : 'good' }));
        const args = [group, route, prep.preparations, returns, incidents.incidents, safety.earlyWarningAlerts, execution.checkIns, checkpoints, []];
        await assert.rejects(closure.finish(...args, { incidents: false, incomplete: false }), { code: 'workflow.errors.openIncidents' });
        const summary = await closure.finish(...args, { incidents: true, incomplete: false });
        assert.equal(summary.openIncidentCount, 1);
        assert.equal(router.db.get('wearable-devices').find({ id: 1 }).value().status, 'maintenance');
        assert.equal(router.db.get('wearable-devices').find({ id: 2 }).value().status, 'lost');
        assert.equal(router.db.get('wearable-devices').find({ id: 3 }).value().status, 'available');
        assert.equal(router.db.get('expedition-groups').find({ id: 1 }).value().status, 'finished');
        await prep.load(); assert.ok(prep.forMember(1).returnedAt);
    });
    await t.test('expired sessions are removed before navigation', async () => {
        const expired = JSON.parse(sessionStorage.getItem('vitaltrek-demo-session')); expired.expiresAt = 0;
        sessionStorage.setItem('vitaltrek-demo-session', JSON.stringify(expired));
        assert.deepEqual(await authenticationGuard({ meta: {}, params: {} }), { name: 'iam-sign-in' });
        assert.equal(iam.user, null);
    });
});
