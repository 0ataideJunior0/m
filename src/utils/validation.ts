export const normalizeNFC = (s: string) => (s ?? '').normalize('NFC')

export const passwordsMatch = (a: string, b: string) => {
  const pa = normalizeNFC(a).trim()
  const pb = normalizeNFC(b).trim()
  if (!pa || !pb) return false
  return pa === pb
}
