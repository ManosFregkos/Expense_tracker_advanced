import type { KidsCardGameMode } from '@family-expense-tracker/shared'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { modeLabels } from '../i18n'

const categoryModes: Record<string, { mode: KidsCardGameMode; icon: string; deckId?: string; label?: string }[]> = {
  numbers: [
    { mode: 'COUNT_FINGERS', icon: '✋', deckId: 'early-numbers', label: 'ΔΑΧΤΥΛΑ' },
    { mode: 'COUNT_OBJECTS', icon: '🍎', deckId: 'early-numbers', label: 'ΜΕΤΡΑΩ' },
    { mode: 'SIMPLE_SUM', icon: '➕', deckId: 'early-numbers', label: 'ΠΡΟΣΘΕΤΩ' },
    { mode: 'COMPARE_QUANTITY', icon: '⚖️', deckId: 'early-numbers', label: 'ΠΕΡΙΣΣΟΤΕΡΑ Ή ΛΙΓΟΤΕΡΑ' },
    { mode: 'MATCH_FINGERS_TO_NUMBER', icon: '🔢', deckId: 'early-numbers', label: 'ΑΡΙΘΜΟΣ ΚΑΙ ΔΑΧΤΥΛΑ' },
    { mode: 'MATCH_QUANTITY_TO_NUMBER', icon: '●', deckId: 'early-numbers', label: 'ΑΡΙΘΜΟΣ ΚΑΙ ΠΟΣΟΤΗΤΑ' },
  ],
  flags: [
    { mode: 'LEARN_FLAG', icon: '🎴', deckId: 'european-flags', label: 'ΜΑΘΑΙΝΩ' },
    { mode: 'FIND_FLAG', icon: '🔎', deckId: 'european-flags', label: 'ΒΡΙΣΚΩ' },
  ],
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
        {modes.map(({ mode, icon, deckId, label }, index) => (
          <button
            type="button"
            key={mode}
            className="kids-mode-card"
            data-tv-focusable="true"
            data-tv-autofocus={index === 0 ? 'true' : undefined}
            onClick={() => void navigate(deckId ? `/kids/play/${mode}/${deckId}` : `/kids/decks/${mode}`)}
          >
            <span>{icon}</span>
            <strong>{label ?? modeLabels[mode]}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}
