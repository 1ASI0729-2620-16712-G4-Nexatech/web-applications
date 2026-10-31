const key = 'vitaltrek-session';

export function readSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(key));
        return session?.expiresAt > Date.now() ? session : null;
    } catch { return null; }
}

export function saveSession(session) {
    if (session) sessionStorage.setItem(key, JSON.stringify(session));
    else sessionStorage.removeItem(key);
}

/** Reads the expiration of a JWT; falls back to the 12-hour lifetime configured in the API. */
export function tokenExpiration(token, fallbackHours = 12) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (Number.isFinite(payload.exp)) return payload.exp * 1000;
    } catch { /* malformed token: use the configured lifetime */ }
    return Date.now() + fallbackHours * 3600000;
}
