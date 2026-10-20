/** URL pronta pro modal de vídeo: YouTube vira embed (com qualidade conforme a rede); o resto passa como está. */
export const resolveVideoUrl = (raw: string): string => {
  const conn = (navigator as any).connection?.effectiveType as string | undefined
  const isYouTube = /youtube\.com|youtu\.be/.test(raw)
  if (isYouTube) {
    const quality = conn?.includes('2g') ? 'small' : conn?.includes('3g') ? 'medium' : 'hd1080'
    const base = raw.replace('watch?v=', 'embed/').replace('shorts/', 'embed/')
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}rel=0&modestbranding=1&controls=1&vq=${quality}`
  }
  return raw
}
