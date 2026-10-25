import { ApplicationError } from '../domain/application-error.js';

export function readLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { throw new ApplicationError('workflow.errors.storage'); }
}
export function queueKey(agencyId) { return `vitaltrek-queue-v1-${agencyId}`; }
export function queuedRecords(agencyId, groupId) {
    return readLocal(queueKey(agencyId), []).filter((record) => record.expeditionGroupId === groupId);
}
export function appendRecord(agencyId, record) {
    const records = readLocal(queueKey(agencyId), []);
    writeLocal(queueKey(agencyId), [...records, record]);
}
export function removeRecords(agencyId, ids) {
    writeLocal(queueKey(agencyId), readLocal(queueKey(agencyId), []).filter((record) => !ids.includes(record.id)));
}
