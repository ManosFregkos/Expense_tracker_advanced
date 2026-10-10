export function registerAppWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // Always resolve from the site root, including /tasks and other deep links.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A tab must reload after an update before requesting removed lazy chunks.
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
  const register = () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => console.warn('Could not register /sw.js:', error))
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
