import type { ChildProfile } from '@family-expense-tracker/shared'
import { assets } from './content'
import type { Round } from './engine'
import type { PlayState } from './types'
import { narration } from './narration'
import { Asset, labels, TVButton } from './KidsUI'

export function KidsGameView({
  play,
  round,
  child,
  observeClock,
  answer,
  message,
  next,
}: {
  play: PlayState
  round: Round
  child: ChildProfile
  observeClock: number
  answer: (id: string) => void
  message: string
  next: () => void
}) {
  return (
    <main className="kids-game">
      <div
        className="kids-progress"
        aria-label={`Γύρος ${play.index + 1} από ${play.rounds.length}`}
      >
        {play.rounds.map((_, index) => (
          <span key={index} className={index <= play.index ? 'active' : ''} />
        ))}
      </div>
      <h1>{play.phase === 'observe' ? labels.look : round.narrationText}</h1>
      <div className="kids-round">
        {round.gameType === 'MEMORY' ? (
          <>
            <div className="kids-memory-scene">
              {play.phase === 'hide' ? (
                <div className="kids-curtain">✨</div>
              ) : (
                round.visible
                  .filter((id) => play.phase === 'observe' || id !== round.missing)
                  .map((id) => <Asset key={id} id={id} />)
              )}
            </div>
            {play.phase === 'observe' ? (
              <div className="kids-observe" aria-label="Χρόνος παρατήρησης">
                <span style={{ width: `${(observeClock / round.observeMs) * 100}%` }} />
              </div>
            ) : null}
            {play.phase === 'answer' || play.phase === 'correct' ? (
              <div className="kids-choices">
                {round.choices.map((id) => (
                  <TVButton
                    key={id}
                    onClick={() => answer(id)}
                    disabled={play.phase === 'correct'}
                    className={play.attempts >= 2 && id === round.missing ? 'kids-hint' : ''}
                  >
                    <Asset id={id} />
                  </TVButton>
                ))}
              </div>
            ) : null}
          </>
        ) : round.gameType === 'EXPLORER' ? (
          <div
            className={`kids-world ${round.world.backdrop}`}
            role="group"
            aria-label={round.world.title}
          >
            {round.world.objects.map((object) => (
              <TVButton
                key={object.id}
                onClick={() => answer(object.id)}
                disabled={play.phase === 'correct'}
                className={`kids-hotspot ${play.attempts >= 2 && object.id === round.targetId ? 'kids-hint' : ''}`}
                ariaLabel={assets[object.id]?.label}
                style={{ left: `${object.x}%`, top: `${object.y}%` }}
              >
                <Asset id={object.id} />
              </TVButton>
            ))}
          </div>
        ) : (
          <>
            <div className="kids-logic-scene">
              <Asset id={round.scenario.illustrationAssetId} />
            </div>
            <div className="kids-choices">
              {round.scenario.options.map((option) => (
                <TVButton
                  key={option.id}
                  onClick={() => answer(option.id)}
                  disabled={play.phase === 'correct'}
                  className={play.attempts >= 2 && option.id === round.targetId ? 'kids-hint' : ''}
                >
                  <Asset id={option.assetId} />
                </TVButton>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="kids-game-footer">
        <TVButton
          onClick={() =>
            narration.speak(
              round.narrationText,
              Boolean(child.narrationEnabled),
              round.narrationAudioUrl,
              true,
            )
          }
          className="kids-small"
          ariaLabel={labels.repeat}
        >
          🔊 {labels.repeat}
        </TVButton>
        <span role="status">{message}</span>
        {play.phase === 'correct' ? (
          <TVButton primary onClick={next} className="kids-small">
            Πάμε! →
          </TVButton>
        ) : null}
      </div>
    </main>
  )
}
