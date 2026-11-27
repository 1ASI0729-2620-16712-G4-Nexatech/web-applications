import { Roles } from '../domain/user.entity.js';

/**
 * Linked registration of a field guide: first the operational profile, then the account that uses its fieldGuideId.
 * The profile created in the first step is remembered for the browser session, so a failed account creation is retried
 * with the same profile instead of registering the guide again.
 */
const storageKey = (administratorId) => `vitaltrek-guide-onboarding-v1-${administratorId}`;

function storage() {
    try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

/** Profile created by this administrator that still has no account, or null. */
export function pendingGuideProfile(administratorId) {
    try { return JSON.parse(storage()?.getItem(storageKey(administratorId)) ?? 'null'); } catch { return null; }
}

export function rememberGuideProfile(administratorId, guide) {
    try { storage()?.setItem(storageKey(administratorId), JSON.stringify({ id: guide.id, name: guide.name, code: guide.code })); }
    catch { /* The flow still works in this page without the reminder. */ }
}

export function forgetGuideProfile(administratorId) {
    try { storage()?.removeItem(storageKey(administratorId)); } catch { /* Nothing to forget. */ }
}

/** True when an account of the agency is already linked to the guide profile. */
export function hasAccount(guide, users) {
    return users.some((user) => user.role === Roles.GUIDE && user.fieldGuideId === guide.id);
}

/** Guide profiles that still need an account, in registration order. */
export function guidesWithoutAccount(guides, users) {
    return guides.filter((guide) => !hasAccount(guide, users));
}
