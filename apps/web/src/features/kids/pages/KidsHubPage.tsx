import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKidsProfiles } from '../hooks'
import { kidsStrings } from '../i18n'

const categories = [
  { id: 'learn', icon: '🎴', title: kidsStrings.learn, subtitle: 'Γνωρίζω νέες κάρτες' },
  { id: 'observe', icon: '👀', title: kidsStrings.observe, subtitle: 'Κοιτάζω προσεκτικά' },
  { id: 'think', icon: '🧠', title: kidsStrings.think, subtitle: 'Βρίσκω τι ταιριάζει' },
  {
    id: 'everyday',
    icon: '🤝',
    title: kidsStrings.everyday,
    subtitle: 'Μαθαίνω για κάθε μέρα',
  },
] as const

export function KidsHubPage() {
  const navigate = useNavigate()
  const profiles = useKidsProfiles()
  const [selected, setSelected] = useState(() => localStorage.getItem('activeKidsProfileId') ?? '')
  useEffect(() => {
    if (profiles.data?.[0] && !profiles.data.some((profile) => profile.id === selected)) {
      setSelected(profiles.data[0].id)
      localStorage.setItem('activeKidsProfileId', profiles.data[0].id)
    }
  }, [profiles.data, selected])
  if (profiles.isLoading) return <div className="kids-center">Ετοιμαζόμαστε…</div>
  if (!profiles.data?.length) {
    return (
      <section className="kids-center">
        <div className="kids-empty-symbol">🌱</div>
        <h1>Πρώτα φτιάχνουμε ένα παιδικό προφίλ</h1>
        <button
          type="button"
          className="kids-primary-action"
          onClick={() => void navigate('/settings/kids')}
          data-tv-focusable="true"
          data-tv-autofocus="true"
        >
          ΡΥΘΜΙΣΕΙΣ ΓΟΝΕΑ
        </button>
      </section>
    )
  }
  return (
    <section className="kids-hub">
      <div className="kids-profile-picker" aria-label="Παιδικό προφίλ">
        {profiles.data.map((profile, index) => (
          <button
            type="button"
            key={profile.id}
            className="kids-profile-chip"
            data-active={selected === profile.id}
            data-tv-focusable="true"
            data-tv-autofocus={index === 0 ? 'true' : undefined}
            onClick={() => {
              setSelected(profile.id)
              localStorage.setItem('activeKidsProfileId', profile.id)
            }}
          >
            <span>{profile.avatar}</span>
            {profile.displayName}
          </button>
        ))}
      </div>
      <h1>{kidsStrings.hubTitle}</h1>
      <div className="kids-category-grid">
        {categories.map((category) => (
          <button
            type="button"
            key={category.id}
            className="kids-category-card"
            data-tv-focusable="true"
            onClick={() => void navigate(`/kids/modes/${category.id}`)}
          >
            <span className="kids-category-icon">{category.icon}</span>
            <strong>{category.title}</strong>
            <small>{category.subtitle}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
