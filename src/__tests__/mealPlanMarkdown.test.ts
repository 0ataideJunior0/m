import { describe, it, expect } from 'vitest'
import { splitMealPlanMarkdown } from '../utils/mealPlanMarkdown'

const SAMPLE = `# Título do plano

**Foco:** 1.800 kcal

## 1) CAFÉ DA MANHÃ

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Ovos | 2 unidades |

**Dica:** coma bem.

### Substituições Possíveis por Grupo

| Grupo | Opção |
|---|---|
| Carboidratos | Pão |

## 2) ALMOÇO

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Arroz | 100g |

---

## ⭐ TABELA DE SUBSTITUIÇÕES – PORÇÕES EQUIVALENTES

### Carboidratos – Porções Equivalentes

| Alimento | Quantidade |
|---|---|
| Arroz | 100g |

### Proteínas – Porções Equivalentes

| Alimento | Quantidade |
|---|---|
| Frango | 100g |

---

## ORIENTAÇÕES GERAIS

Beba água.
`

describe('splitMealPlanMarkdown', () => {
  it('separa cada "### Substituições" em um bloco colapsável próprio', () => {
    const segments = splitMealPlanMarkdown(SAMPLE)
    const collapsibleTitles = segments.filter((s) => s.type === 'collapsible').map((s) => s.title)
    expect(collapsibleTitles).toContain('Substituições Possíveis por Grupo')
  })

  it('separa a tabela geral "## TABELA DE SUBSTITUIÇÕES" como um único bloco, com as subseções internas', () => {
    const segments = splitMealPlanMarkdown(SAMPLE)
    const tabela = segments.find((s) => s.type === 'collapsible' && /TABELA DE SUBSTITUIÇÕES/.test(s.title || ''))
    expect(tabela).toBeDefined()
    expect(tabela!.content).toContain('Carboidratos')
    expect(tabela!.content).toContain('Proteínas')
    expect(tabela!.content).toContain('Frango')
  })

  it('mantém "Opção Principal" e orientações gerais nos blocos normais (markdown), fora do dropdown', () => {
    const segments = splitMealPlanMarkdown(SAMPLE)
    const normalText = segments.filter((s) => s.type === 'markdown').map((s) => s.content).join('\n')
    expect(normalText).toContain('Opção Principal')
    expect(normalText).toContain('Ovos')
    expect(normalText).toContain('Arroz')
    expect(normalText).toContain('ORIENTAÇÕES GERAIS')
    expect(normalText).toContain('Beba água')
  })

  it('não deixa o conteúdo de substituições vazar pros blocos normais', () => {
    const segments = splitMealPlanMarkdown(SAMPLE)
    const normalText = segments.filter((s) => s.type === 'markdown').map((s) => s.content).join('\n')
    expect(normalText).not.toContain('Pão')
    expect(normalText).not.toContain('Frango')
  })

  it('preserva a ordem original: refeição 1 antes da refeição 2', () => {
    const segments = splitMealPlanMarkdown(SAMPLE)
    const flat = segments.map((s) => s.content).join('\n---SEG---\n')
    expect(flat.indexOf('CAFÉ DA MANHÃ')).toBeLessThan(flat.indexOf('ALMOÇO'))
  })
})
