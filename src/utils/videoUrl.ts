const YOUTUBE_HOSTS = /^(www\.|m\.)?(youtube\.com|youtu\.be)$/

/** ID do vídeo em youtu.be/ID, watch?v=ID (com ou sem &t=), shorts/ID, embed/ID e live/ID. */
const youtubeId = (raw: string): string | null => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!YOUTUBE_HOSTS.test(url.hostname)) return null
  if (url.hostname.endsWith('youtu.be')) return url.pathname.split('/')[1] || null
  const fromQuery = url.searchParams.get('v')
  if (fromQuery) return fromQuery
  const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)
  return match ? match[1] : null
}

/** URL pronta pro modal de vídeo: YouTube vira embed (com qualidade conforme a rede); o resto passa como está. */
export const resolveVideoUrl = (raw: string): string => {
  const id = youtubeId(raw)
  if (!id) return raw
  const conn = (navigator as any).connection?.effectiveType as string | undefined
  const quality = conn?.includes('2g') ? 'small' : conn?.includes('3g') ? 'medium' : 'hd1080'
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&controls=1&vq=${quality}`
}
