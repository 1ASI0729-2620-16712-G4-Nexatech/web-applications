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

/**
 * S04 and S05 against a local HTTP double of POST/GET /api/v1/sync-batches: contract payload, partial results,
 * retries with the same clientBatchId, lost responses, reloads, concurrent clicks and queue separation.
 */
test('checkpoint sync sends H0 batches, keeps unconfirmed records and retries the same batch', async (t) => {
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.document = { documentElement: {} };
    const group = { id: 18, agencyId: 4, routeId: 3, fieldGuideId: 7, status: 'active' };
    const first = { id: 10, location: 'Start' }, second = { id: 11, location: 'Ridge' };
    const checkpoints = [first, second];
    const session = { id: 42, expeditionGroupId: group.id, agencyId: group.agencyId, status: 'active', startedAt: '2026-11-10T13:01:02Z' };
    const posts = [];
    const stored = new Map();
    let mode = 'ok';
    let release;
    const server = createHttpServer(async (request, response) => {
        const reply = (status, payload) => {
            response.writeHead(status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
        };
        if (request.headers.authorization !== 'Bearer guide-test') return reply(401, {});
        if (request.method === 'POST' && request.url === '/api/v1/tracking-sessions') return reply(201, session);
        if (request.method === 'POST' && request.url === '/api/v1/sync-batches') {
            let body = '';
            for await (const piece of request) body += piece;
            const batch = JSON.parse(body);
            posts.push(batch);
            if (mode === 'drop') return request.socket.destroy();
            if (mode === 'unconfirmed') return reply(202, {});
            if (mode === 'conflict') return reply(409, { code: 'SyncBatch.RecordIdentityConflict' });
            if (mode === 'slow') await new Promise((resolve) => { release = resolve; });
            const result = stored.get(batch.clientBatchId) ?? {
                batchId: 900 + stored.size + 1, clientBatchId: batch.clientBatchId, sessionId: batch.sessionId,
                checkpointId: batch.checkpointId, receivedAt: '2026-11-10T14:00:00.000000+00:00',
                acceptedRecordIds: [...batch.readings, ...batch.passages]
                    .filter((record) => record.heartRate !== 999).map((record) => record.clientRecordId),
                duplicateRecordIds: [],
                rejectedRecords: batch.readings.filter((reading) => reading.heartRate === 999)
                    .map((reading) => ({ clientRecordId: reading.clientRecordId, code: 'Telemetry.InvalidHeartRate' })),
                evaluationStatus: 'pending',
            };
            stored.set(batch.clientBatchId, result);
            return reply(202, result);
        }
        const detail = request.url.match(/^\/api\/v1\/sync-batches\/(\d+)$/);
        if (request.method === 'GET' && detail) {
            const result = [...stored.values()].find((item) => item.batchId === Number(detail[1]));
            return result ? reply(200, result) : reply(404, {});
        }
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
    const [
        { default: useIamStore },
        { default: useTrackingStore },
        { default: useExecutionStore },
        { default: useSyncStore },
        { saveSession },
        { Roles },
        { appendRecord, queuedRecords, queueKey },
    ] = await Promise.all([
        vite.ssrLoadModule('/src/iam/application/iam.store.js'),
        vite.ssrLoadModule('/src/field-tracking/application/field-tracking.store.js'),
        vite.ssrLoadModule('/src/field-tracking/application/expedition-execution.store.js'),
        vite.ssrLoadModule('/src/checkpoint-sync/application/checkpoint-sync.store.js'),
        vite.ssrLoadModule('/src/iam/infrastructure/iam-session.js'),
        vite.ssrLoadModule('/src/iam/domain/user.entity.js'),
        vite.ssrLoadModule('/src/shared/infrastructure/offline-storage.js'),
    ]);
    saveSession({ user: { id: 5, agencyId: 4, fieldGuideId: 7, role: Roles.GUIDE }, token: 'guide-test', expiresAt: Date.now() + 60_000 });

    function open() {
        const pinia = createPinia();
        useIamStore(pinia);
        const tracking = useTrackingStore(pinia);
        tracking.rememberStartedSession(group, session);
        return { execution: useExecutionStore(pinia), sync: useSyncStore(pinia) };
    }

    const member = { id: 21, expeditionGroupId: group.id };
    const preparation = { memberId: member.id, expeditionGroupId: group.id, wearableId: 27, ready: true };
    const values = { heartRate: 81, battery: 97, latitude: -9, longitude: -77, altitude: 4100, deviationMeters: 4.5 };
    let { execution, sync } = open();

    // Records of another kind, another user or the TB1 queue are never sent nor removed.
    appendRecord(group.agencyId, { id: 'evacuation-1', kind: 'evacuation-action', expeditionGroupId: group.id, agencyId: 4, userId: 5, sessionId: session.id });
    appendRecord(group.agencyId, { id: 'other-user', clientRecordId: 'other-user', kind: 'telemetry', expeditionGroupId: group.id, agencyId: 4, userId: 6, sessionId: session.id, recordedAt: '2026-11-10T13:05:00Z' });
    localStorage.setItem(queueKey(4), JSON.stringify([{ id: 'tb1', kind: 'telemetry', expeditionGroupId: group.id, agencyId: 4 }]));
    const valid = execution.capture(group, member, preparation, values);
    const anomalous = execution.capture(group, member, preparation, { ...values, heartRate: 999 });
    execution.checkIn(group, first, checkpoints);
    assert.equal(sync.pendingCount(group), 3);
    assert.equal(sync.legacyCount(group), 1);

    // A lost response keeps the records and the batch identity.
    mode = 'drop';
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncRetry' });
    const firstBatchId = posts[0].clientBatchId;
    assert.equal(sync.pendingCount(group), 3);
    assert.equal(sync.pendingBatch(group).clientBatchId, firstBatchId);
    assert.deepEqual(Object.keys(posts[0]).sort(), ['checkpointId', 'clientBatchId', 'passages', 'readings', 'sessionId']);
    assert.deepEqual(Object.keys(posts[0].readings[0]).sort(), ['altitude', 'battery', 'clientRecordId', 'deviationMeters',
        'heartRate', 'latitude', 'longitude', 'recordedAt', 'wearableDeviceId']);
    assert.deepEqual(Object.keys(posts[0].passages[0]).sort(), ['checkpointId', 'clientRecordId', 'passedAt']);
    assert.equal(posts[0].readings[0].recordedAt, valid.recordedAt);
    assert.equal(posts[0].readings.length + posts[0].passages.length, 3);

    // A 202 without confirmations does not remove anything either.
    mode = 'unconfirmed';
    await assert.rejects(sync.synchronize(group, second, checkpoints), { code: 'workflow.errors.syncUnconfirmed' });
    assert.equal(posts[1].clientBatchId, firstBatchId);
    assert.equal(sync.pendingCount(group), 3);

    // After a reload the same batch is resent; only confirmed records leave the queue.
    ({ execution, sync } = open());
    mode = 'ok';
    const result = await sync.synchronize(group, second, checkpoints);
    assert.equal(posts[2].clientBatchId, firstBatchId);
    assert.equal(posts[2].checkpointId, first.id);
    assert.equal(result.acceptedRecordIds.length, 2);
    assert.equal(sync.pendingBatch(group), null);
    assert.equal(sync.pendingCount(group), 0);
    const [rejected] = sync.rejectedRecords(group);
    assert.equal(rejected.id, anomalous.id);
    assert.equal(rejected.rejection.code, 'Telemetry.InvalidHeartRate');
    assert.equal(sync.lastReceivedAt(group), '2026-11-10T14:00:00.000000+00:00');
    assert.equal(sync.history(group)[0].batchId, result.batchId);
    assert.deepEqual(queuedRecords(4, group.id).map((record) => record.id).sort(), [anomalous.id, 'evacuation-1', 'other-user', 'tb1'].sort());
    assert.deepEqual(sync.telemetry.map((reading) => reading.clientRecordId), [valid.id]);
    assert.equal((await sync.refreshBatch(group, result.batchId)).batchId, result.batchId);

    // Rejected records are not resent; a new capture travels in a new batch.
    execution.capture(group, member, preparation, values);
    mode = 'slow';
    const sending = sync.synchronize(group, first, checkpoints);
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncInProgress' });
    while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
    release();
    await sending;
    assert.equal(posts.length, 4);
    assert.notEqual(posts[3].clientBatchId, firstBatchId);
    assert.equal(posts[3].readings.length, 1);
    assert.ok(posts[3].readings.every((reading) => reading.clientRecordId !== anomalous.id));

    // A batch rejected as a whole keeps every record and builds a new batch next time.
    mode = 'conflict';
    execution.capture(group, member, preparation, values);
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncRecordConflict' });
    assert.equal(sync.pendingCount(group), 1);
    assert.equal(sync.pendingBatch(group), null);

    // Discarding a rejected record requires an explicit decision.
    sync.discardRejected(group, anomalous.id);
    assert.equal(sync.rejectedRecords(group).length, 0);
});
