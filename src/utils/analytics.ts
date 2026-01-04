export const trackEvent = (name: string, data?: Record<string, any>) => {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && typeof window.va === 'function') {
      // @ts-ignore
      window.va('event', { name, data })
    }
  } catch {}
}

