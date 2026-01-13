export function getCSRFToken() {
  let t = ''
  try { t = sessionStorage.getItem('csrf_token') || '' } catch {}
  if (!t) {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    t = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('')
    try { sessionStorage.setItem('csrf_token', t) } catch {}
  }
  return t
}

export function getOriginAllowed() {
  const allowed = [location.origin]
  return allowed.includes(location.origin)
}

