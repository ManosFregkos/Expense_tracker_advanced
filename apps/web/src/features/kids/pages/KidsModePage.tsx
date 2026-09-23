import type { KidsCardGameMode } from '@family-expense-tracker/shared'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { modeLabels } from '../i18n'

const categoryModes: Record<string, { mode: KidsCardGameMode; icon: string }[]> = {
  learn: [{ mode: 'LEARN_AND_CHOOSE', icon: '🎴' }],
  observe: [
    { mode: 'SAME_OR_DIFFERENT', icon: '👀' },
    { mode: 'COMPARE', icon: '⚖️' },
    { mode: 'MEMORY_PAIRS', icon: '🃏' },
  ],
  think: [
    { mode: 'MATCHING', icon: '🧩' },
    { mode: 'ODD_ONE_OUT', icon: '🔎' },
    { mode: 'CLASSIFY', icon: '🏠' },
    { mode: 'SEQUENCE', icon: '➡️' },
  ],
  everyday: [
    { mode: 'EVERYDAY_CHOICE', icon: '🤝' },
    { mode: 'EMOTION', icon: '🙂' },
  ],
}

export function KidsModePage() {
  const { category = '' } = useParams()
  const navigate = useNavigate()
  const modes = categoryModes[category]
  if (!modes) return <Navigate to="/kids" replace />
  return (
    <section className="kids-selection-page">
      <h1>Διάλεξε παιχνίδι</h1>
      <div className="kids-mode-grid">
        {modes.map(({ mode, icon }, index) => (
          <button
            type="button"
            key={mode}
            className="kids-mode-card"
            data-tv-focusable="true"
            data-tv-autofocus={index === 0 ? 'true' : undefined}
            onClick={() => void navigate(`/kids/decks/${mode}`)}
          >
            <span>{icon}</span>
            <strong>{modeLabels[mode]}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}
