import { KIDS_CARD_GAME_MODES, type KidsCardGameMode } from '@family-expense-tracker/shared'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { KIDS_ASSETS, SYSTEM_DECKS, getSupportedModes } from '../content/system'
import { useKidsContent } from '../hooks'

function isMode(value: string): value is KidsCardGameMode {
  return KIDS_CARD_GAME_MODES.includes(value as KidsCardGameMode)
}

export function KidsDeckPage() {
  const { mode = '' } = useParams()
  const navigate = useNavigate()
  const content = useKidsContent()
  if (!isMode(mode)) return <Navigate to="/kids" replace />
  if (content.isLoading) return <div className="kids-center">Ετοιμαζόμαστε…</div>
  const decks = SYSTEM_DECKS.filter(
    (deck) => deck.enabled && getSupportedModes(deck).includes(mode),
  )
  return (
    <section className="kids-selection-page">
      <h1>Διάλεξε κάρτες</h1>
      <div className="kids-deck-grid">
        {decks.map((deck, index) => {
          const firstAsset = KIDS_ASSETS.get(deck.cardIds[0] ?? '')
          return (
            <button
              type="button"
              key={deck.id}
              className="kids-deck-card"
              data-tv-focusable="true"
              data-tv-autofocus={index === 0 ? 'true' : undefined}
              onClick={() => void navigate(`/kids/play/${mode}/${deck.id}`)}
            >
              <span style={{ background: firstAsset?.color }}>{firstAsset?.symbol ?? '⭐'}</span>
              <strong>{deck.title}</strong>
            </button>
          )
        })}
      </div>
    </section>
  )
}
