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

const group = { id: 18, agencyId: 4, routeId: 3, fieldGuideId: 7, status: 'active' };
const first = { id: 10, location: 'Start' }, second = { id: 11, location: 'Ridge' };
const checkpoints = [first, second];
const session = { id: 42, expeditionGroupId: group.id, agencyId: group.agencyId, status: 'active', startedAt: '2026-11-10T13:01:02Z' };
const member = { id: 21, expeditionGroupId: group.id };
const preparation = { memberId: member.id, expeditionGroupId: group.id, wearableId: 27, ready: true };
const values = { heartRate: 81, battery: 97, latitude: -9, longitude: -77, altitude: 4100, deviationMeters: 4.5 };

/**
 * Local HTTP double of POST/GET /api/v1/sync-batches. Readings with heart rate 999 and passages at a checkpoint in
 * rejectedCheckpoints are rejected with a code; a stored batch is answered again with the same result.
 */
async function startHarness(t) {
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.document = { documentElement: {} };
    const harness = { posts: [], stored: new Map(), mode: 'ok', rejectedCheckpoints: new Set(), release: null };
    const server = createHttpServer(async (request, response) => {
        const reply = (status, payload) => {
            response.writeHead(status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
        };
        if (request.headers.authorization !== 'Bearer guide-test') return reply(401, {});
        if (request.method === 'POST' && request.url === '/api/v1/sync-batches') {
            let body = '';
            for await (const piece of request) body += piece;
            const batch = JSON.parse(body);
            harness.posts.push(batch);
            if (harness.mode === 'drop') return request.socket.destroy();
            if (harness.mode === 'unconfirmed') return reply(202, {});
            if (harness.mode === 'conflict') return reply(409, { code: 'SyncBatch.RecordIdentityConflict' });
            if (harness.mode === 'slow') await new Promise((resolve) => { harness.release = resolve; });
            const rejectedReadings = batch.readings.filter((reading) => reading.heartRate === 999)
                .map((reading) => ({ clientRecordId: reading.clientRecordId, code: 'Telemetry.InvalidHeartRate' }));
            const rejectedPassages = batch.passages.filter((passage) => harness.rejectedCheckpoints.has(passage.checkpointId))
                .map((passage) => ({ clientRecordId: passage.clientRecordId, code: 'Passage.OutOfSequence' }));
            const rejected = [...rejectedReadings, ...rejectedPassages];
            const result = harness.stored.get(batch.clientBatchId) ?? {
                batchId: 900 + harness.stored.size + 1, clientBatchId: batch.clientBatchId, sessionId: batch.sessionId,
                checkpointId: batch.checkpointId, receivedAt: `2026-11-10T14:0${harness.stored.size}:00.000000+00:00`,
                acceptedRecordIds: [...batch.readings, ...batch.passages].map((record) => record.clientRecordId)
                    .filter((id) => !rejected.some((item) => item.clientRecordId === id)),
                duplicateRecordIds: [], rejectedRecords: rejected, evaluationStatus: 'pending',
            };
            harness.stored.set(batch.clientBatchId, result);
            // The batch is committed, but the response is lost on the way back.
            if (harness.mode === 'storeThenDrop') return request.socket.destroy();
            return reply(202, result);
        }
        const detail = request.url.match(/^\/api\/v1\/sync-batches\/(\d+)$/);
        if (request.method === 'GET' && detail) {
            const result = [...harness.stored.values()].find((item) => item.batchId === Number(detail[1]));
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
        { default: useIamStore }, { default: useTrackingStore }, { default: useExecutionStore }, { default: useSyncStore },
        { saveSession }, { Roles }, storage,
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
    harness.storage = storage;
    /** A fresh page load: new stores over the same local storage, with the session confirmed by the server. */
    harness.open = (confirmedCheckpointIds = []) => {
        const pinia = createPinia();
        useIamStore(pinia);
        const tracking = useTrackingStore(pinia);
        tracking.rememberStartedSession(group, session);
        const confirm = (ids) => {
            tracking.entries[group.id] = {
                ...tracking.entries[group.id],
                progress: {
                    sessionId: session.id, expeditionGroupId: group.id,
                    confirmedCheckpoints: ids.map((checkpointId) => ({ checkpointId })),
                },
            };
        };
        confirm(confirmedCheckpointIds);
        return { tracking, confirm, execution: useExecutionStore(pinia), sync: useSyncStore(pinia) };
    };
    return harness;
}

test('checkpoint sync sends H0 batches, keeps unconfirmed records and retries the same batch', async (t) => {
    const harness = await startHarness(t);
    const { posts, storage } = harness;
    let { execution, sync, confirm } = harness.open();

    // Records of another kind, another user or the TB1 queue are never sent nor removed.
    storage.appendRecord(group.agencyId, { id: 'evacuation-1', kind: 'evacuation-action', expeditionGroupId: group.id, agencyId: 4, userId: 5, sessionId: session.id });
    storage.appendRecord(group.agencyId, { id: 'other-user', clientRecordId: 'other-user', kind: 'telemetry', expeditionGroupId: group.id, agencyId: 4, userId: 6, sessionId: session.id, recordedAt: '2026-11-10T13:05:00Z' });
    localStorage.setItem(storage.queueKey(4), JSON.stringify([{ id: 'tb1', kind: 'telemetry', expeditionGroupId: group.id, agencyId: 4 }]));
    const valid = execution.capture(group, member, preparation, values);
    const anomalous = execution.capture(group, member, preparation, { ...values, heartRate: 999 });
    execution.checkIn(group, first, checkpoints);
    assert.equal(sync.pendingCount(group), 3);
    assert.equal(sync.legacyCount(group), 1);
    assert.deepEqual(sync.syncCheckpoints(group, checkpoints), [first]);

    // A lost response keeps the records and the batch identity.
    harness.mode = 'drop';
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncRetry' });
    const firstBatchId = posts[0].clientBatchId;
    assert.equal(sync.pendingCount(group), 3);
    assert.equal(sync.pendingBatch(group).clientBatchId, firstBatchId);
    assert.deepEqual(Object.keys(posts[0]).sort(), ['checkpointId', 'clientBatchId', 'passages', 'readings', 'sessionId']);
    assert.deepEqual(Object.keys(posts[0].readings[0]).sort(), ['altitude', 'battery', 'clientRecordId', 'deviationMeters',
        'heartRate', 'latitude', 'longitude', 'recordedAt', 'wearableDeviceId']);
    assert.deepEqual(Object.keys(posts[0].passages[0]).sort(), ['checkpointId', 'clientRecordId', 'passedAt']);
    assert.equal(posts[0].readings[0].recordedAt, valid.recordedAt);

    // A 202 without confirmations does not remove anything either.
    harness.mode = 'unconfirmed';
    await assert.rejects(sync.synchronize(group, second, checkpoints), { code: 'workflow.errors.syncUnconfirmed' });
    assert.equal(posts[1].clientBatchId, firstBatchId);
    assert.equal(sync.pendingCount(group), 3);

    // After a reload the same batch is resent; only confirmed records leave the queue.
    ({ execution, sync, confirm } = harness.open());
    harness.mode = 'ok';
    const result = await sync.synchronize(group, second, checkpoints);
    assert.equal(posts[2].clientBatchId, firstBatchId);
    assert.equal(posts[2].checkpointId, first.id);
    assert.equal(result.acceptedRecordIds.length, 2);
    assert.equal(sync.pendingBatch(group), null);
    assert.equal(sync.pendingCount(group), 0);
    const [rejected] = sync.rejectedRecords(group);
    assert.equal(rejected.id, anomalous.id);
    assert.equal(rejected.rejection.code, 'Telemetry.InvalidHeartRate');
    assert.equal(sync.lastReceivedAt(group), result.receivedAt);
    assert.equal(sync.history(group)[0].batchId, result.batchId);
    assert.deepEqual(storage.queuedRecords(4, group.id).map((record) => record.id).sort(), [anomalous.id, 'evacuation-1', 'other-user', 'tb1'].sort());
    assert.equal((await sync.refreshBatch(group, result.batchId)).batchId, result.batchId);

    // Rejected records are not resent; a new capture travels in a new batch from a confirmed arrival.
    confirm([first.id]);
    execution.capture(group, member, preparation, values);
    harness.mode = 'slow';
    const sending = sync.synchronize(group, first, checkpoints);
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncInProgress' });
    while (!harness.release) await new Promise((resolve) => setTimeout(resolve, 5));
    harness.release();
    await sending;
    assert.equal(posts.length, 4);
    assert.notEqual(posts[3].clientBatchId, firstBatchId);
    assert.equal(posts[3].readings.length, 1);
    assert.ok(posts[3].readings.every((reading) => reading.clientRecordId !== anomalous.id));

    // A batch rejected as a whole keeps every record and builds a new batch next time.
    harness.mode = 'conflict';
    execution.capture(group, member, preparation, values);
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncRecordConflict' });
    assert.equal(sync.pendingCount(group), 1);
    assert.equal(sync.pendingBatch(group), null);

    // Discarding a rejected record requires an explicit decision.
    sync.discardRejected(group, anomalous.id);
    assert.equal(sync.rejectedRecords(group).length, 0);
});

test('captures saved by the M04 queue are counted as soon as Synchronization opens', async (t) => {
    const harness = await startHarness(t);
    const { storage } = harness;
    const scoped = (id, kind, extra) => ({
        id, clientRecordId: id, kind, sessionId: session.id, expeditionGroupId: group.id, agencyId: group.agencyId,
        fieldGuideId: 7, userId: 5, recordedAt: '2026-11-10T13:10:00Z', ...extra,
    });
    // M04 wrote every capture to the agency-wide TB1 key.
    localStorage.setItem(storage.queueKey(group.agencyId), JSON.stringify([
        scoped('m04-reading', 'telemetry', { memberId: 21, wearableDeviceId: 27, ...values }),
        scoped('m04-passage', 'check-in', { checkpointId: first.id, passedAt: '2026-11-10T13:10:00Z' }),
    ]));
    const { sync, execution } = harness.open();

    assert.equal(sync.pendingCount(group), 0);
    sync.prepare(group);
    assert.equal(sync.pendingCount(group), 2);
    assert.equal(sync.legacyCount(group), 0);
    assert.equal(execution.pendingRecords(group).length, 2);
    assert.deepEqual(sync.syncCheckpoints(group, checkpoints), [first]);
    await sync.synchronize(group, first, checkpoints);
    assert.equal(sync.pendingCount(group), 0);
});

test('a stored batch whose response was lost is recovered with the same id after the expedition closes', async (t) => {
    const harness = await startHarness(t);
    const { posts } = harness;
    const { execution, sync, tracking } = harness.open();
    execution.checkIn(group, first, checkpoints);
    execution.capture(group, member, preparation, values);

    harness.mode = 'storeThenDrop';
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.syncRetry' });
    tracking.entries[group.id] = { ...tracking.entries[group.id], session: { sessionId: session.id, status: 'completed' } };
    const closedGroup = { ...group, status: 'finished' };

    harness.mode = 'ok';
    const recovered = await sync.synchronize(closedGroup, null, checkpoints);
    assert.equal(posts.length, 2);
    assert.equal(posts[1].clientBatchId, posts[0].clientBatchId);
    assert.equal(recovered.acceptedRecordIds.length, 2);
    assert.equal(sync.pendingBatch(closedGroup), null);
    assert.equal(sync.pendingCount(closedGroup), 0);
    // Without a pending batch, a closed session accepts no new batch and nothing else is sent.
    await assert.rejects(sync.synchronize(closedGroup, first, checkpoints), { code: 'workflow.errors.notActive' });
    assert.equal(posts.length, 2);
});

test('a batch needs a valid arrival and a rejected passage does not enable the next checkpoint', async (t) => {
    const harness = await startHarness(t);
    const { posts } = harness;
    const { execution, sync, confirm } = harness.open();

    execution.capture(group, member, preparation, values);
    assert.deepEqual(sync.syncCheckpoints(group, checkpoints), []);
    await assert.rejects(sync.synchronize(group, first, checkpoints), { code: 'workflow.errors.checkpointArrival' });
    assert.equal(posts.length, 0);

    confirm([first.id]);
    execution.checkIn(group, second, checkpoints);
    harness.rejectedCheckpoints.add(second.id);
    await sync.synchronize(group, first, checkpoints);
    const [rejectedPassage] = sync.rejectedRecords(group);
    assert.equal(rejectedPassage.checkpointId, second.id);
    assert.equal(rejectedPassage.rejection.code, 'Passage.OutOfSequence');
    assert.equal(execution.nextCheckpoint(group, checkpoints).id, second.id);
    assert.deepEqual(sync.syncCheckpoints(group, checkpoints), [first]);
});

test('a full queue reserves room for the selected arrival and its earlier required passage', async (t) => {
    const { open, posts, storage } = await startHarness(t);
    const { execution, sync, confirm } = open();
    const scope = { agencyId: group.agencyId, userId: 5, expeditionGroupId: group.id, sessionId: session.id };
    const readings = Array.from({ length: 500 }, (_, index) => {
        const id = crypto.randomUUID();
        return {
            ...scope, ...values, id, clientRecordId: id, kind: 'telemetry', fieldGuideId: 7,
            memberId: member.id, wearableDeviceId: preparation.wearableId,
            recordedAt: new Date(Date.UTC(2026, 10, 10, 13, 10, index)).toISOString(),
        };
    });
    storage.appendRecord(group.agencyId, readings[0]);
    storage.writeLocal(storage.scopeKey(scope), readings);
    execution.checkIn(group, first, checkpoints);
    execution.checkIn(group, second, checkpoints);
    const queuedPassages = storage.scopedRecords(scope).filter((item) => item.kind === 'check-in');

    assert.equal(sync.pendingCount(group), 502);
    await sync.synchronize(group, second, checkpoints);
    assert.equal(posts[0].readings.length + posts[0].passages.length, 500);
    assert.deepEqual(posts[0].passages, queuedPassages.map(({ clientRecordId, checkpointId, passedAt }) =>
        ({ clientRecordId, checkpointId, passedAt })));
    assert.deepEqual(posts[0].readings.map((item) => item.clientRecordId),
        readings.slice(0, 498).map((item) => item.clientRecordId));
    assert.equal(sync.pendingCount(group), 2);

    confirm([first.id, second.id]);
    await sync.synchronize(group, second, checkpoints);
    assert.deepEqual(posts[1].passages, []);
    assert.deepEqual(posts[1].readings.map(({ clientRecordId, recordedAt }) => ({ clientRecordId, recordedAt })),
        readings.slice(498).map(({ clientRecordId, recordedAt }) => ({ clientRecordId, recordedAt })));
    assert.equal(sync.pendingCount(group), 0);
});
