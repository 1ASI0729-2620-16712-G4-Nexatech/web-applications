import { ApplicationError } from '../domain/application-error.js';

export function readLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { throw new ApplicationError('workflow.errors.storage'); }
}

const legacyPrefix = 'vitaltrek-queue-v1-';
const scopePrefix = 'vitaltrek-queue-v2-';

/** Key of the TB1 queue shared by a whole agency; only kept to migrate or report its records. */
export function queueKey(agencyId) { return `${legacyPrefix}${agencyId}`; }

/** Offline queue of one user, in one agency, group and tracking session, so queues are never mixed. */
export function scopeKey({ agencyId, userId, expeditionGroupId, sessionId }) {
    return `${scopePrefix}${agencyId}-${userId}-${expeditionGroupId}-${sessionId}`;
}

function indexKey(agencyId) { return `${scopePrefix}index-${agencyId}`; }

function isPositiveId(value) { return Number.isInteger(value) && value > 0; }

function isScoped(record) {
    return [record?.agencyId, record?.userId, record?.expeditionGroupId, record?.sessionId].every(isPositiveId);
}

function scopeOf(record) {
    return {
        agencyId: record.agencyId, userId: record.userId,
        expeditionGroupId: record.expeditionGroupId, sessionId: record.sessionId,
    };
}

function scopeKeys(agencyId) { return readLocal(indexKey(agencyId), []); }

function appendScoped(record) {
    const key = scopeKey(scopeOf(record));
    const keys = scopeKeys(record.agencyId);
    // The index is written first, so a stored record can always be found again.
    if (!keys.includes(key)) writeLocal(indexKey(record.agencyId), [...keys, key]);
    const records = readLocal(key, []);
    if (!records.some((item) => item.id === record.id)) writeLocal(key, [...records, record]);
}

/**
 * Moves TB1 records that already carry their user, group and session into their own queue. Records without a
 * tracking session stay in the legacy queue: they are reported, never sent nor deleted automatically.
 */
export function migrateLegacyQueue(agencyId) {
    const legacy = readLocal(queueKey(agencyId), []);
    const movable = legacy.filter((record) => isScoped(record) && record.agencyId === agencyId);
    if (!movable.length) return;
    movable.forEach(appendScoped);
    writeLocal(queueKey(agencyId), legacy.filter((record) => !movable.includes(record)));
}

export function appendRecord(agencyId, record) {
    if (isScoped(record) && record.agencyId === agencyId) {
        migrateLegacyQueue(agencyId);
        appendScoped(record);
        return;
    }
    writeLocal(queueKey(agencyId), [...readLocal(queueKey(agencyId), []), record]);
}

/** Records of one user and tracking session, in insertion order. */
export function scopedRecords(scope) { return readLocal(scopeKey(scope), []); }

/** TB1 records of a group that have no tracking session and cannot be sent to the RESTful API. */
export function legacyRecords(agencyId, groupId) {
    return readLocal(queueKey(agencyId), []).filter((record) => record.expeditionGroupId === groupId && !isScoped(record));
}

export function queuedRecords(agencyId, groupId) {
    const scoped = scopeKeys(agencyId).flatMap((key) => readLocal(key, []));
    return [...readLocal(queueKey(agencyId), []), ...scoped].filter((record) => record.expeditionGroupId === groupId);
}

function updateQueues(agencyId, change) {
    for (const key of [queueKey(agencyId), ...scopeKeys(agencyId)]) {
        const records = readLocal(key, []);
        const updated = change(records);
        if (updated !== records) writeLocal(key, updated);
    }
}

export function removeRecords(agencyId, ids) {
    const removed = new Set(ids);
    updateQueues(agencyId, (records) => records.some((record) => removed.has(record.id))
        ? records.filter((record) => !removed.has(record.id))
        : records);
}

/** Keeps rejected records visible with their reason; they are excluded from new batches until corrected. */
export function markRejected(scope, rejections) {
    const byId = new Map(rejections.map((rejection) => [rejection.clientRecordId, rejection]));
    const key = scopeKey(scope);
    const records = readLocal(key, []);
    if (!records.some((record) => byId.has(record.id))) return;
    writeLocal(key, records.map((record) => byId.has(record.id) ? { ...record, rejection: byId.get(record.id) } : record));
}
