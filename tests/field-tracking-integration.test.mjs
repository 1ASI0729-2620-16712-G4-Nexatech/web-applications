import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
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

test('field tracking starts a real session, preserves server progress, and queues guide captures', async (t) => {
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.document = { documentElement: {} };
    const group = { id: 18, agencyId: 4, routeId: 3, fieldGuideId: 7, status: 'scheduled' };
    const activeGroup = { ...group, status: 'active' };
    const first = { id: 10, location: 'Start' }, second = { id: 11, location: 'Ridge' };
    const confirmedAt = '2026-11-10T13:10:02Z';
    const session = { id: 42, expeditionGroupId: group.id, agencyId: group.agencyId, status: 'active', startedAt: '2026-11-10T13:01:02Z' };
    const confirmed = { checkpointId: first.id, sequenceOrder: 1, location: first.location, passedAt: session.startedAt, synchronizedAt: confirmedAt };
    const progress = {
        sessionId: session.id, expeditionGroupId: group.id, routeId: group.routeId, status: 'active',
        startedAt: session.startedAt, endedAt: null, totalCheckpoints: 2, confirmedCheckpointsCount: 1,
        estimatedProgressPercentage: 50, confirmedCheckpoints: [confirmed], lastConfirmedCheckpoint: confirmed,
        nextCheckpoint: { checkpointId: second.id, sequenceOrder: 2, location: second.location },
        participants: [
            { memberId: 21, heartRate: 81, recordedAt: session.startedAt, synchronizedAt: confirmedAt },
            { memberId: 22, heartRate: 89, recordedAt: session.startedAt, synchronizedAt: confirmedAt },
        ],
        synchronizedAt: confirmedAt,
    };
    const writes = [];
    let lookup = 'ready';
    const server = createHttpServer(async (request, response) => {
        const reply = (status, payload) => {
            response.writeHead(status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
        };
        const token = request.headers.authorization;
        if (request.method === 'POST' && request.url === '/api/v1/tracking-sessions' && token === 'Bearer guide-test') {
            let body = '';
            for await (const piece of request) body += piece;
            writes.push(JSON.parse(body));
            return reply(writes.length === 1 ? 201 : 200, session);
        }
        if (request.method === 'GET' && request.url === '/api/v1/expedition-groups/18/tracking-progress') {
            if (lookup === 'offline') return request.socket.destroy();
            if (lookup === 'empty') return reply(404, { code: 'Tracking.ProgressNotFound' });
            if (lookup === 'missingEndpoint') return reply(404, {});
            if (token === 'Bearer guide-test') return reply(200, progress);
            if (token === 'Bearer tourist-test') return reply(200, { ...progress, participants: [progress.participants[0]] });
        }
        return reply(401, {});
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
    const [
        { default: useIamStore },
        { default: useTrackingStore },
        { default: useExecutionStore },
        { default: useCheckpointSyncStore },
        { saveSession },
        { Roles },
    ] = await Promise.all([
        vite.ssrLoadModule('/src/iam/application/iam.store.js'),
        vite.ssrLoadModule('/src/field-tracking/application/field-tracking.store.js'),
        vite.ssrLoadModule('/src/field-tracking/application/expedition-execution.store.js'),
        vite.ssrLoadModule('/src/checkpoint-sync/application/checkpoint-sync.store.js'),
        vite.ssrLoadModule('/src/iam/infrastructure/iam-session.js'),
        vite.ssrLoadModule('/src/iam/domain/user.entity.js'),
    ]);
    const guide = {
        user: { id: 5, agencyId: 4, fieldGuideId: 7, role: Roles.GUIDE },
        token: 'guide-test',
        expiresAt: Date.now() + 60_000,
    };
    saveSession(guide);
    const initialPinia = createPinia();
    useIamStore(initialPinia);
    const tracking = useTrackingStore(initialPinia);
    const execution = useExecutionStore(initialPinia);
    assert.equal(execution.canCapture(group), false);
    assert.equal((await execution.start(group)).startedAt, session.startedAt);
    assert.equal((await execution.start(group)).id, session.id);
    assert.deepEqual(writes, [{ expeditionGroupId: group.id }, { expeditionGroupId: group.id }]);
    await tracking.fetchGroupProgress(activeGroup);

    const member = { id: 21, expeditionGroupId: group.id };
    const preparation = { memberId: member.id, expeditionGroupId: group.id, wearableId: 27, ready: true };
    const values = { heartRate: 81, battery: 97, latitude: -9, longitude: -77, altitude: 4100, deviationMeters: 4.5 };
    assert.throws(() => execution.capture(activeGroup, member, preparation, { ...values, battery: 15.5 }), {
        code: 'workflow.errors.invalid',
    });
    assert.throws(() => execution.checkIn(activeGroup, first, [first, second]), { code: 'workflow.errors.checkpointOrder' });
    const reading = execution.capture(activeGroup, member, preparation, values);
    execution.checkIn(activeGroup, second, [first, second]);
    const [savedReading, savedPassage] = execution.pendingRecords(activeGroup);
    assert.equal(savedReading.clientRecordId, reading.id);
    assert.equal(savedReading.sessionId, session.id);
    assert.equal(savedReading.wearableDeviceId, 27);
    assert.equal(savedReading.altitude, 4100);
    assert.equal(savedPassage.passedAt, savedPassage.recordedAt);
    assert.equal(savedPassage.checkpointId, second.id);
    assert.equal(execution.checkIns.length, 1);
    assert.equal(tracking.entries[group.id].progress.estimatedProgressPercentage, 50);
    await assert.rejects(useCheckpointSyncStore(initialPinia).synchronize(activeGroup, second, [first, second]), {
        code: 'workflow.errors.syncUnavailable',
    });
    assert.equal(execution.pendingRecords(activeGroup).length, 2);

    const reload = createPinia();
    const reloadedIam = useIamStore(reload);
    const reloadedTracking = useTrackingStore(reload);
    const reloadedExecution = useExecutionStore(reload);
    lookup = 'offline';
    await reloadedTracking.fetchGroupProgress(activeGroup);
    assert.equal(reloadedTracking.entries[group.id].state, 'offline');
    assert.equal(reloadedTracking.entries[group.id].progress.participants.length, 0);
    assert.equal(reloadedExecution.canCapture(activeGroup), true);
    assert.equal(reloadedExecution.pendingRecords(activeGroup)[0].clientRecordId, reading.id);
    assert.deepEqual(reloadedExecution.pendingRecords(activeGroup).map((item) => item.recordedAt), [
        savedReading.recordedAt, savedPassage.recordedAt,
    ]);
    lookup = 'ready';
    await reloadedTracking.fetchGroupProgress(activeGroup);
    assert.equal(reloadedTracking.entries[group.id].progress.synchronizedAt, confirmedAt);
    assert.equal(reloadedTracking.entries[group.id].progress.participants.length, 2);

    const tourist = {
        user: { id: 9, agencyId: 4, role: Roles.TOURIST, identityDocument: 'test-tourist' },
        token: 'tourist-test',
        expiresAt: guide.expiresAt,
    };
    saveSession(tourist);
    reloadedIam.session = tourist;
    assert.equal(reloadedTracking.entries[group.id], undefined);
    assert.equal(reloadedExecution.pendingRecords(activeGroup).length, 0);
    assert.throws(() => reloadedExecution.capture(activeGroup, member, preparation, values), { code: 'workflow.errors.forbidden' });
    await reloadedTracking.fetchGroupProgress(activeGroup);
    assert.deepEqual(reloadedTracking.entries[group.id].progress.participants.map((item) => item.memberId), [21]);

    lookup = 'empty';
    await reloadedTracking.fetchGroupProgress(activeGroup);
    assert.equal(reloadedTracking.entries[group.id].state, 'empty');
    lookup = 'missingEndpoint';
    await reloadedTracking.fetchGroupProgress(activeGroup);
    assert.equal(reloadedTracking.entries[group.id].state, 'unavailable');
});
