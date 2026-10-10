// Compatibility for browsers registered before the shared PWA/push worker.
// This URL must serve JavaScript, never the SPA's HTML fallback.
globalThis.importScripts('/sw.js')
