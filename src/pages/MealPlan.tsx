import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { getMealPlan, MealPlan as MealPlanData, PlanType } from '../utils/plans'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import Markdown from '../components/ui/Markdown'

export default function MealPlan({ type }: { type: PlanType }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<MealPlanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getMealPlan(type).then((data) => {
      setPlan(data)
      setLoading(false)
    })
  }, [type])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="print:hidden">
          <PageHeader
            title={plan?.title || 'Plano alimentar'}
            onBack={() => navigate('/home')}
            right={
              plan && (
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
              )
            }
          />
        </div>

        <Card>
          {plan ? (
            <Markdown content={plan.content_md} />
          ) : (
            <p className="text-gray-600 dark:text-text-muted">Plano alimentar indisponível no momento.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
