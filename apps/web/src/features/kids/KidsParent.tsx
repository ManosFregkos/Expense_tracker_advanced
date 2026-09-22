import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  customLogicSchema,
  type ChildProfile,
  type ChildProfileInput,
} from '@family-expense-tracker/shared'
import { assets, type LogicScenario } from './content'
import { archiveCustomLogic, saveChildProfile, saveCustomLogic, type KidsProgress } from './api'
import { avatarGlyph, TVButton } from './KidsUI'

export function ParentArea({
  householdId,
  children,
  child,
  progress,
  customLogic,
  onSaved,
  navigate,
}: {
  householdId: string
  children: ChildProfile[]
  child: ChildProfile | undefined
  progress: KidsProgress[]
  customLogic: LogicScenario[]
  onSaved: () => Promise<void>
  navigate: (path: string) => void
}) {
  const [name, setName] = useState(''),
    [avatar, setAvatar] = useState<'star' | 'moon' | 'sun' | 'flower'>('star')
  const [title, setTitle] = useState(''),
    [question, setQuestion] = useState(''),
    [scene, setScene] = useState('rain')
  const [options, setOptions] = useState(['umbrella', 'pillow', 'glasses']),
    [preferred, setPreferred] = useState(0)
  const [difficulty, setDifficulty] = useState(1),
    [skill, setSkill] = useState<'LOGIC' | 'CAUSE_EFFECT' | 'CLASSIFICATION'>('CAUSE_EFFECT')
  const [explanation, setExplanation] = useState('')
  const [profileDraft, setProfileDraft] = useState<ChildProfileInput | null>(null)
  const [notice, setNotice] = useState('')
  const { pathname } = useLocation()
  useEffect(() => {
    if (!child) {
      setProfileDraft(null)
      return
    }
    setProfileDraft({
      householdId,
      childProfileId: child.id,
      displayName: child.displayName,
      avatarId: child.avatarId ?? 'star',
      ageBand: child.ageBand,
      preferredLanguage: 'el-GR',
      defaultDifficultyMode: child.defaultDifficultyMode,
      sessionLength: child.sessionLength,
      soundEnabled: child.soundEnabled,
      narrationEnabled: child.narrationEnabled,
      animationsEnabled: child.animationsEnabled,
    })
  }, [child, householdId])
  const saveProfile = async (patch: Partial<ChildProfileInput> = {}) => {
    try {
      const input: ChildProfileInput = profileDraft
        ? { ...profileDraft, ...patch }
        : {
            householdId,
            displayName: name,
            avatarId: avatar,
            ageBand: '3_PLUS',
            preferredLanguage: 'el-GR',
            defaultDifficultyMode: 'AUTO',
            sessionLength: 5,
            soundEnabled: true,
            narrationEnabled: true,
            animationsEnabled: true,
          }
      setProfileDraft(input)
      await saveChildProfile(input)
      setNotice('Αποθηκεύτηκε')
      await onSaved()
    } catch {
      setNotice('Δεν αποθηκεύτηκε. Δοκίμασε ξανά.')
    }
  }
  const saveScenario = async () => {
    try {
      const input = customLogicSchema.parse({
        householdId,
        title,
        difficulty,
        skill,
        narrationText: question,
        illustrationAssetId: scene,
        options: options.map((assetId, index) => ({
          id: `option-${index}`,
          assetId,
          label: assets[assetId]?.label ?? assetId,
          isPreferredAnswer: index === preferred,
          ...(index === preferred && explanation ? { explanationNarration: explanation } : {}),
        })),
      })
      await saveCustomLogic(input)
      setTitle('')
      setQuestion('')
      setNotice('Αποθηκεύτηκε')
      await onSaved()
    } catch {
      setNotice('Έλεγξε τα πεδία και ξαναπροσπάθησε.')
    }
  }
  const childProgress = progress.filter((item) => item.childProfileId === child?.id)
  return (
    <div className="kids-parent">
      <header>
        <TVButton onClick={() => navigate('/kids')}>← Παιχνίδια</TVButton>
        <h1>Kids · Για γονείς</h1>
        <TVButton onClick={() => navigate('/dashboard')}>Έξοδος Kids Mode</TVButton>
      </header>
      <nav>
        <TVButton onClick={() => navigate('/kids/parent')}>Επισκόπηση</TVButton>
        <TVButton onClick={() => navigate('/kids/parent/progress')}>Πρόοδος</TVButton>
        <TVButton onClick={() => navigate('/kids/parent/content')}>Περιεχόμενο</TVButton>
      </nav>
      <p role="status">{notice}</p>
      {pathname.endsWith('/content') ? (
        <>
          <section>
            <h2>Νέο σενάριο</h2>
            <label>
              Τίτλος
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Ερώτηση
              <input value={question} onChange={(e) => setQuestion(e.target.value)} />
            </label>
            <label>
              Δυσκολία
              <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
                <option value="1">Εύκολη</option>
                <option value="2">Μέτρια</option>
                <option value="3">Δύσκολη</option>
              </select>
            </label>
            <label>
              Δεξιότητα
              <select value={skill} onChange={(e) => setSkill(e.target.value as typeof skill)}>
                <option value="CAUSE_EFFECT">Αιτία και αποτέλεσμα</option>
                <option value="LOGIC">Λογική</option>
                <option value="CLASSIFICATION">Ταξινόμηση</option>
              </select>
            </label>
            <label>
              Εικόνα σκηνής
              <select value={scene} onChange={(e) => setScene(e.target.value)}>
                {Object.values(assets).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.glyph} {item.label}
                  </option>
                ))}
              </select>
            </label>
            {options.map((value, index) => (
              <label key={index}>
                Επιλογή {index + 1}
                <select
                  value={value}
                  onChange={(e) =>
                    setOptions((current) =>
                      current.map((item, i) => (i === index ? e.target.value : item)),
                    )
                  }
                >
                  {Object.values(assets).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.glyph} {item.label}
                    </option>
                  ))}
                </select>
                <input
                  type="radio"
                  name="preferred"
                  checked={preferred === index}
                  onChange={() => setPreferred(index)}
                />{' '}
                Προτιμώμενη απάντηση
              </label>
            ))}
            <TVButton
              onClick={() =>
                setOptions((current) =>
                  current.length === 2 ? [...current, 'glasses'] : current.slice(0, 2),
                )
              }
            >
              {options.length === 2 ? 'Προσθήκη 3ης επιλογής' : 'Αφαίρεση 3ης επιλογής'}
            </TVButton>
            <label>
              Επεξήγηση αφήγησης
              <input value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </label>
            <TVButton onClick={() => void saveScenario()}>Αποθήκευση</TVButton>
          </section>
          <section>
            <h2>Προσαρμοσμένα σενάρια</h2>
            {customLogic.map((item) => (
              <div key={item.id} className="kids-custom-row">
                <span>{item.title}</span>
                <TVButton
                  onClick={() => {
                    void archiveCustomLogic({ householdId, contentId: item.id })
                      .then(onSaved)
                      .then(() => setNotice('Αρχειοθετήθηκε'))
                      .catch(() => setNotice('Δεν ήταν δυνατή η αρχειοθέτηση.'))
                  }}
                >
                  Αρχειοθέτηση
                </TVButton>
              </div>
            ))}
          </section>
        </>
      ) : pathname.endsWith('/progress') ? (
        <section>
          <h2>{child?.displayName ?? 'Πρόοδος'}</h2>
          {childProgress.map((item) => (
            <p key={item.gameType}>
              {item.gameType}: {item.sessionsPlayed ?? 0} παιχνίδια · {item.roundsPlayed ?? 0} γύροι
              · τρέχουσα πρόκληση {item.currentDifficulty ?? 1}
            </p>
          ))}
        </section>
      ) : (
        <section>
          <h2>Παιδιά</h2>
          {children.map((item) => (
            <p key={item.id}>
              {avatarGlyph[item.avatarId ?? 'star']} {item.displayName}
            </p>
          ))}
          {!child ? (
            <>
              <label>
                Όνομα
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Εικόνα
                <select value={avatar} onChange={(e) => setAvatar(e.target.value as typeof avatar)}>
                  {Object.keys(avatarGlyph).map((id) => (
                    <option key={id}>{id}</option>
                  ))}
                </select>
              </label>
              <TVButton onClick={() => void saveProfile()}>Προσθήκη παιδιού</TVButton>
            </>
          ) : (
            <>
              <h2>Ρυθμίσεις · {child.displayName}</h2>
              <label>
                Δυσκολία
                <select
                  value={profileDraft?.defaultDifficultyMode ?? child.defaultDifficultyMode}
                  onChange={(e) => {
                    void saveProfile({
                      defaultDifficultyMode: e.target
                        .value as ChildProfileInput['defaultDifficultyMode'],
                    })
                  }}
                >
                  <option value="AUTO">Αυτόματα</option>
                  <option value="EASY">Εύκολα</option>
                  <option value="MEDIUM">Μέτρια</option>
                  <option value="HARD">Δύσκολα</option>
                </select>
              </label>
              <label>
                Γύροι
                <select
                  value={profileDraft?.sessionLength ?? child.sessionLength}
                  onChange={(e) => {
                    void saveProfile({ sessionLength: Number(e.target.value) as 5 | 10 | 15 })
                  }}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                </select>
              </label>
              {(['narrationEnabled', 'soundEnabled', 'animationsEnabled'] as const).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={profileDraft?.[key] ?? child[key]}
                    onChange={(e) => {
                      void saveProfile({ [key]: e.target.checked })
                    }}
                  />
                  {key === 'narrationEnabled'
                    ? 'Αφήγηση'
                    : key === 'soundEnabled'
                      ? 'Ήχοι'
                      : 'Κίνηση'}
                </label>
              ))}
              <h2>Πρόσφατη δραστηριότητα</h2>
              {childProgress.map((item) => (
                <p key={item.gameType}>
                  {item.gameType}: {item.sessionsPlayed ?? 0} παιχνίδια
                </p>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  )
}
