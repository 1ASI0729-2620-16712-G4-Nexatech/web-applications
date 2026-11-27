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

/** Alert resource as returned by GET/PATCH /api/v1/early-warning-alerts. */
function alertResource(overrides = {}) {
    return {
        id: 31, sessionId: 42, expeditionGroupId: 18, agencyId: 4, checkpointId: null,
        alertType: 'vital_sign_anomaly', severity: 'high', status: 'active',
        description: 'Heart rate outside the participant baseline.', raisedAt: '2026-11-10T14:05:00+00:00',
        rule: 'heart_rate_outside_baseline', memberId: 21,
        evidence: {
            observedValue: 160, expectedMinimum: 50, expectedMaximum: 140, unit: 'bpm',
            recordedAt: '2026-11-10T13:58:00+00:00', sourceRecordId: '5f0c1e1a-4a7d-4f41-9a55-0d3c1f6c2b10', simulated: true,
        },
        acknowledgedByUserId: null, acknowledgedAt: null, closedByUserId: null, closedAt: null,
        ...overrides,
    };
}

/**
 * Vite SSR over a local HTTP double of /api/v1/early-warning-alerts. The double answers the open alerts, the alerts of
 * a session and the status changes, and records every request so the tests can check what the client sent.
 */
async function startHarness(t) {
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.document = { documentElement: {} };
    const harness = {
        requests: [],
        open: [alertResource(), alertResource({ id: 32, alertType: 'delay', severity: 'medium', status: 'acknowledged', rule: 'checkpoint_delay', memberId: null, checkpointId: 11, evidence: { observedValue: 95, expectedMinimum: null, expectedMaximum: 60, unit: 'min', recordedAt: '2026-11-10T14:00:00+00:00', sourceRecordId: null, simulated: false }, acknowledgedByUserId: 5, acknowledgedAt: '2026-11-10T14:10:00+00:00' })],
        closed: [alertResource({ id: 30, severity: 'low', status: 'dismissed', closedByUserId: 5, closedAt: '2026-11-10T13:50:00+00:00' })],
        patchStatus: 200,
        evaluationStatus: 200,
    };
    const server = createHttpServer(async (request, response) => {
        const reply = (status, payload) => {
            response.writeHead(status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(payload));
        };
        let body = '';
        for await (const piece of request) body += piece;
        harness.requests.push({ method: request.method, url: request.url, body: body ? JSON.parse(body) : null });
        if (!request.headers.authorization?.startsWith('Bearer ')) return reply(401, {});
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/api/v1/early-warning-alerts') {
            const sessionId = url.searchParams.get('sessionId');
            return reply(200, sessionId ? [...harness.open, ...harness.closed].filter((alert) => alert.sessionId === Number(sessionId)) : harness.open);
        }
        const status = url.pathname.match(/^\/api\/v1\/early-warning-alerts\/(\d+)\/status$/);
        if (request.method === 'PATCH' && status) {
            if (harness.patchStatus !== 200) return reply(harness.patchStatus, 'Localized message');
            const alert = harness.open.find((item) => item.id === Number(status[1]));
            const changed = { ...alert, status: JSON.parse(body).status, closedByUserId: 5, closedAt: '2026-11-10T14:20:00+00:00' };
            return reply(200, changed);
        }
        if (request.method === 'POST' && url.pathname === '/api/v1/early-warning-alerts/evaluations') {
            if (harness.evaluationStatus !== 200) return reply(harness.evaluationStatus, 'Localized message');
            return reply(200, [alertResource({ id: 33, alertType: 'delay', severity: 'high', rule: 'checkpoint_delay', memberId: null, checkpointId: 12, evidence: { observedValue: 130, expectedMaximum: 90, unit: 'min', recordedAt: '2026-11-10T14:30:00+00:00', simulated: false } })]);
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
    const [{ default: useSafetyStore }, { saveSession }, { Roles }, { EarlyWarningAlertAssembler }] = await Promise.all([
        vite.ssrLoadModule('/src/safety-monitoring/application/safety-monitoring.store.js'),
        vite.ssrLoadModule('/src/iam/infrastructure/iam-session.js'),
        vite.ssrLoadModule('/src/iam/domain/user.entity.js'),
        vite.ssrLoadModule('/src/safety-monitoring/infrastructure/early-warning-alert.assembler.js'),
    ]);
    harness.assembler = EarlyWarningAlertAssembler;
    /** A fresh page load signed in with the given role. */
    harness.signIn = (role = Roles.GUIDE) => {
        saveSession({ user: { id: 5, agencyId: 4, fieldGuideId: role === Roles.GUIDE ? 7 : null, role }, token: `${role}-test`, expiresAt: Date.now() + 60_000 });
        return useSafetyStore(createPinia());
    };
    harness.Roles = Roles;
    return harness;
}

test('the assembler maps the API codes and the evidence, and drops alerts it cannot represent', async (t) => {
    const { assembler } = await startHarness(t);
    const alert = assembler.toEntityFromResource(alertResource());
    assert.equal(alert.type, 'vital-sign-anomaly');
    assert.equal(alert.priority, 'high');
    assert.equal(alert.rule, 'heart_rate_outside_baseline');
    assert.equal(alert.triggeredAt, '2026-11-10T14:05:00+00:00');
    assert.equal(alert.isOpen, true);
    assert.equal(alert.evidence.metricType, 'heart-rate');
    assert.equal(alert.evidence.observedValue, '160 bpm');
    assert.equal(alert.evidence.expectedValue, '50–140 bpm');
    assert.equal(alert.evidence.recordedAt, '2026-11-10T13:58:00+00:00');
    assert.equal(alert.evidence.simulated, true);

    const delay = assembler.toEntityFromResource(alertResource({ alertType: 'delay', rule: 'checkpoint_delay', evidence: { observedValue: 95, expectedMaximum: 60, unit: 'min', recordedAt: '2026-11-10T14:00:00Z' } }));
    assert.equal(delay.evidence.expectedValue, '≤ 60 min');
    assert.equal(delay.evidence.metricType, 'elapsed-time');
    const manual = assembler.toEntityFromResource(alertResource({ alertType: 'other', rule: 'manual', evidence: null }));
    assert.equal(manual.type, 'other');
    assert.equal(manual.isManual, true);
    assert.deepEqual(manual.riskEvidence, []);

    assert.equal(assembler.toEntityFromResource(alertResource({ alertType: 'unknown' })), null);
    assert.equal(assembler.toEntityFromResource(alertResource({ severity: 'extreme' })), null);
    assert.equal(assembler.toEntityFromResource(alertResource({ evidence: { observedValue: 1, unit: 'kg' } })), null);
    assert.equal(assembler.toEntitiesFromResponse({ status: 200, data: [alertResource(), alertResource({ status: 'lost' })] }).length, 1);
    assert.deepEqual(assembler.toEntitiesFromResponse({ status: 500, data: [alertResource()] }), []);
});

test('the store reads open alerts and session history, and only requests status transitions', async (t) => {
    const harness = await startHarness(t);
    const safety = harness.signIn();
    assert.equal(safety.canManageAlerts, true);

    await safety.fetchEarlyWarningAlerts();
    assert.deepEqual(safety.earlyWarningAlerts.map((alert) => alert.id).sort(), [31, 32]);
    assert.equal(safety.activeEarlyWarningAlertsCount, 1);
    await safety.fetchAlertsForSession(42);
    assert.deepEqual(safety.getEarlyWarningAlertsByGroupId(18).map((alert) => alert.id), [31, 32, 30]);

    // The closed history read for the session survives the next read of the open alerts.
    await safety.fetchEarlyWarningAlerts();
    assert.equal(safety.earlyWarningAlerts.some((alert) => alert.id === 30), true);

    const dismissed = await safety.dismissAlertAsFalseAlarm(31);
    assert.equal(dismissed.status, 'dismissed');
    assert.equal(dismissed.closedByUserId, 5);
    const patch = harness.requests.find((request) => request.method === 'PATCH');
    assert.equal(patch.url, '/api/v1/early-warning-alerts/31/status');
    assert.deepEqual(patch.body, { status: 'dismissed' });

    // The client never raises alerts nor writes the group progress: the server evaluates the persisted data.
    assert.equal(harness.requests.some((request) => request.method === 'POST'), false);
    assert.equal(harness.requests.some((request) => request.url.includes('/group-progress')), false);
    assert.deepEqual(safety.errors, []);
});

test('the store refuses invalid transitions locally and translates the refusals of the server', async (t) => {
    const harness = await startHarness(t);
    const safety = harness.signIn();
    await safety.fetchAlertsForSession(42);
    const sent = () => harness.requests.filter((request) => request.method === 'PATCH').length;

    // An active alert cannot be resolved before it is acknowledged, and a closed one accepts no action.
    assert.equal(await safety.resolveAlert(31), null);
    assert.equal(await safety.acknowledgeAlert(30), null);
    assert.equal(sent(), 0);
    assert.deepEqual(safety.errors.map((error) => error.code), ['workflow.errors.transition', 'errors.earlyWarningAlertNotActionable']);
    safety.clearErrors();

    harness.patchStatus = 409;
    assert.equal(await safety.acknowledgeAlert(31), null);
    harness.patchStatus = 404;
    assert.equal(await safety.resolveAlert(32), null);
    assert.equal(sent(), 2);
    assert.deepEqual(safety.errors.map((error) => error.code), ['errors.earlyWarningAlertNotActionable', 'workflow.errors.notFound']);
});

test('a guide asks the server to evaluate delays now; a refused evaluation explains why', async (t) => {
    const harness = await startHarness(t);
    const safety = harness.signIn();
    const raised = await safety.requestEvaluation(42);
    assert.deepEqual(raised.map((alert) => alert.id), [33]);
    assert.equal(safety.getEarlyWarningAlertsByGroupId(18)[0].evidence.expectedValue, '≤ 90 min');
    const evaluation = harness.requests.find((request) => request.method === 'POST');
    assert.equal(evaluation.url, '/api/v1/early-warning-alerts/evaluations');
    assert.deepEqual(evaluation.body, { sessionId: 42 });

    harness.evaluationStatus = 409;
    assert.deepEqual(await safety.requestEvaluation(42), []);
    assert.deepEqual(safety.errors.map((error) => error.code), ['errors.safetyEvaluationUnavailable']);
});

test('a tourist reads alerts but cannot act on them', async (t) => {
    const harness = await startHarness(t);
    const safety = harness.signIn(harness.Roles.TOURIST);
    assert.equal(safety.canManageAlerts, false);
    await safety.fetchEarlyWarningAlerts();
    assert.equal(await safety.acknowledgeAlert(31), null);
    assert.deepEqual(await safety.requestEvaluation(42), []);
    assert.equal(harness.requests.some((request) => ['PATCH', 'POST'].includes(request.method)), false);
    assert.deepEqual(safety.errors.map((error) => error.code), ['workflow.errors.forbidden', 'workflow.errors.forbidden']);
});

test('every alert code shown by the views has a text in English and Spanish', async () => {
    const { readFile } = await import('node:fs/promises');
    const codes = {
        type: ['delay', 'vital-sign-anomaly', 'route-deviation', 'other'],
        priority: ['low', 'medium', 'high', 'critical'],
        status: ['active', 'acknowledged', 'resolved', 'dismissed'],
        rule: ['manual', 'heart_rate_outside_baseline', 'simulated_route_deviation', 'checkpoint_delay'],
        metric: ['heart-rate', 'route-position', 'elapsed-time'],
        audit: ['acknowledged', 'resolved', 'dismissed', 'you', 'user', 'unknownUser'],
    };
    for (const language of ['en', 'es']) {
        const messages = JSON.parse(await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), 'utf8'));
        const alerts = messages.earlyWarningAlerts;
        for (const [group, keys] of Object.entries(codes)) {
            for (const key of keys) assert.equal(typeof alerts[group]?.[key], 'string', `${language}: earlyWarningAlerts.${group}.${key}`);
        }
        for (const key of ['raisedAt', 'capturedAt', 'simulatedNotice', 'groupRisk', 'participant', 'refresh', 'sessionTitle', 'evaluateNow', 'noSession', 'noSessionAlerts']) {
            assert.equal(typeof alerts[key], 'string', `${language}: earlyWarningAlerts.${key}`);
        }
        assert.equal(typeof messages.errors.safetyEvaluationUnavailable, 'string', `${language}: errors.safetyEvaluationUnavailable`);
    }
});
