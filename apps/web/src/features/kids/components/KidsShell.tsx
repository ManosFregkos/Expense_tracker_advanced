import { IconArrowLeft } from '@tabler/icons-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TVFocusProvider } from './TVFocusProvider'

export function KidsShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHub = location.pathname === '/kids'
  const back = () => {
    if (!isHub) void navigate('/kids')
  }
  return (
    <TVFocusProvider focusKey={location.pathname} onBack={back}>
      <main className="kids-shell" data-tv-focus-root="true">
        <header className="kids-header">
          {!isHub ? (
            <button
              type="button"
              className="kids-back"
              onClick={back}
              data-tv-focusable="true"
              aria-label="Πίσω στα παιχνίδια"
            >
              <IconArrowLeft aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
          <div className="kids-brand">Μαζί Μαθαίνουμε</div>
          {isHub ? (
            <button
              type="button"
              className="kids-exit"
              onClick={() => void navigate('/dashboard')}
              data-tv-focusable="true"
            >
              ΕΞΟΔΟΣ
            </button>
          ) : (
            <span />
          )}
        </header>
        <Outlet />
      </main>
    </TVFocusProvider>
  )
}
