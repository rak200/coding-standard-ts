/**
 * Canary for RFC 0017 step 5 — a deliberate incomplete URL sanitisation, to fire the
 * repaired CodeQL gate. CodeQL reports this below `error` level, which is exactly the
 * band the gate used to ignore. Never merged.
 */
export function isTrusted(url) {
    return url.indexOf('rak200.com') !== -1;
}
