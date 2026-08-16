import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MealPlan from '../pages/MealPlan'

const { getMealPlanMock } = vi.hoisted(() => ({ getMealPlanMock: vi.fn() }))

vi.mock('../utils/plans', () => ({ getMealPlan: getMealPlanMock }))

describe('MealPlan', () => {
  beforeEach(() => {
    getMealPlanMock.mockReset()
  })

  it('renderiza o título e o conteúdo markdown do plano', async () => {
    getMealPlanMock.mockResolvedValueOnce({
      type: 'mass_gain',
      title: 'Plano Alimentar • Ganho de Massa',
      description: null,
      content_md: '## Café da manhã\n\n| Alimento | Quantidade |\n|---|---|\n| Ovos | 3 unidades |',
      updated_at: '',
    })

    render(
      <MemoryRouter>
        <MealPlan type="mass_gain" />
      </MemoryRouter>
    )

    expect(await screen.findByText('Plano Alimentar • Ganho de Massa')).not.toBeNull()
    expect(await screen.findByText('Café da manhã')).not.toBeNull()
    expect(screen.getByText('Ovos')).not.toBeNull()
    expect(getMealPlanMock).toHaveBeenCalledWith('mass_gain')
  })

  it('coloca as substituições num dropdown, deixando a opção principal sempre visível', async () => {
    getMealPlanMock.mockResolvedValueOnce({
      type: 'mass_gain',
      title: 'Plano Alimentar • Ganho de Massa',
      description: null,
      content_md:
        '## 1) CAFÉ DA MANHÃ\n\n### Opção Principal\n\n| Alimento | Quantidade |\n|---|---|\n| Ovos | 3 unidades |\n\n### Substituições Possíveis por Grupo\n\n| Grupo | Opção |\n|---|---|\n| Carboidratos | Pão |',
      updated_at: '',
    })

    render(
      <MemoryRouter>
        <MealPlan type="mass_gain" />
      </MemoryRouter>
    )

    expect(await screen.findByText('Opção Principal')).not.toBeNull()
    expect(screen.getByText('Ovos')).not.toBeNull()

    const summary = screen.getByText('Substituições Possíveis por Grupo')
    expect(summary.closest('details')).not.toBeNull()
    expect(summary.closest('details')).not.toHaveAttribute('open')
  })

  it('mostra mensagem quando o plano não está disponível (ex.: sem assinatura ativa)', async () => {
    getMealPlanMock.mockResolvedValueOnce(null)

    render(
      <MemoryRouter>
        <MealPlan type="fat_loss" />
      </MemoryRouter>
    )

    expect(await screen.findByText('Plano alimentar indisponível no momento.')).not.toBeNull()
  })
})
