export interface MealPlanSegment {
  type: 'markdown' | 'collapsible'
  title?: string
  content: string
}

const H2 = /^##(?!#)\s+(.*)$/
const H3 = /^###(?!#)\s+(.*)$/
const SUBSTITUTIONS = /substitui/i

// Separa o markdown do plano em blocos normais e blocos de substituição
// (tanto as subseções "### Substituições..." de cada refeição quanto a
// tabela geral "## TABELA DE SUBSTITUIÇÕES"), preservando a ordem original.
// A UI usa isso pra manter só as refeições principais em destaque e colapsar
// o resto num dropdown, sem precisar reescrever o conteúdo salvo no banco.
export function splitMealPlanMarkdown(content: string): MealPlanSegment[] {
  const lines = content.split('\n')
  const segments: MealPlanSegment[] = []
  let buffer: string[] = []
  let i = 0

  const flushMarkdown = () => {
    if (buffer.length) {
      segments.push({ type: 'markdown', content: buffer.join('\n') })
      buffer = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const h2 = H2.exec(line)
    const h3 = h2 ? null : H3.exec(line)
    const isH2Sub = h2 && SUBSTITUTIONS.test(h2[1])
    const isH3Sub = h3 && SUBSTITUTIONS.test(h3[1])

    if (isH2Sub || isH3Sub) {
      flushMarkdown()
      const title = (isH2Sub ? h2![1] : h3![1]).trim()
      const sectionLines: string[] = []
      i++
      while (i < lines.length) {
        const l = lines[i]
        const stop = isH2Sub ? H2.test(l) || /^---\s*$/.test(l) : H2.test(l) || H3.test(l)
        if (stop) break
        sectionLines.push(l)
        i++
      }
      segments.push({ type: 'collapsible', title, content: sectionLines.join('\n').trim() })
      continue
    }

    buffer.push(line)
    i++
  }
  flushMarkdown()
  return segments
}
