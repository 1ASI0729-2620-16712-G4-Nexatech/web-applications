const key = 'vitaltrek-demo-session';

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
