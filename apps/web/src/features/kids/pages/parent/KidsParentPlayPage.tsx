import { Button, Card, Checkbox, NativeSelect, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KidsCardGameMode } from '@family-expense-tracker/shared'
import { DECKS_BY_ID, SYSTEM_DECKS, getSupportedModes } from '../../content/system'
import { useKidsContent, useKidsProfiles } from '../../hooks'
import { modeLabels } from '../../i18n'

const modes = Object.keys(modeLabels) as KidsCardGameMode[]

export function KidsParentPlayPage() {
  const navigate = useNavigate()
  const profiles = useKidsProfiles()
  const content = useKidsContent()
  const [profileId, setProfileId] = useState('')
  const [mode, setMode] = useState<KidsCardGameMode>('LEARN_AND_CHOOSE')
  const [deckId, setDeckId] = useState('animals')
  const [difficulty, setDifficulty] = useState('1')
  const [rounds, setRounds] = useState('5')
  const [preview, setPreview] = useState(false)
  const decks = SYSTEM_DECKS.filter(
    (deck) =>
      (preview || deck.enabled) &&
      (mode === 'MIXED_PLAY' || getSupportedModes(deck).includes(mode)),
  )
  const activeDeck = decks.some((deck) => deck.id === deckId) ? deckId : (decks[0]?.id ?? '')
  if (content.isLoading || profiles.isLoading) return <div className="page">Φόρτωση…</div>
  return (
    <div className="page">
      <Title order={1}>Άμεσο παιχνίδι γονέα</Title>
      <Text c="dimmed" mb="lg">
        Επιλέξτε παιχνίδι, περιεχόμενο και ήπια δυσκολία.
      </Text>
      <Card withBorder padding="lg" maw={680}>
        <Stack>
          <NativeSelect
            label="Παιδικό προφίλ"
            value={profileId}
            data={[
              { value: '', label: 'Επιλέξτε…' },
              ...(profiles.data?.map((item) => ({ value: item.id, label: item.displayName })) ??
                []),
            ]}
            onChange={(event) => setProfileId(event.currentTarget.value)}
          />
          <NativeSelect
            label="Παιχνίδι"
            value={mode}
            data={modes.map((item) => ({ value: item, label: modeLabels[item] }))}
            onChange={(event) => {
              const next = event.currentTarget.value as KidsCardGameMode
              setMode(next)
              const first = SYSTEM_DECKS.find(
                (deck) =>
                  (preview || deck.enabled) &&
                  (next === 'MIXED_PLAY' || getSupportedModes(deck).includes(next)),
              )
              if (first) setDeckId(first.id)
            }}
          />
          <NativeSelect
            label="Τράπουλα"
            value={activeDeck}
            data={decks.map((deck) => ({ value: deck.id, label: deck.title }))}
            onChange={(event) => setDeckId(event.currentTarget.value)}
          />
          <NativeSelect
            label="Δυσκολία"
            value={difficulty}
            data={[
              { value: '1', label: 'Εύκολη' },
              { value: '2', label: 'Μεσαία' },
              { value: '3', label: 'Δύσκολη' },
              { value: '4', label: 'Πολύ δύσκολη' },
            ]}
            onChange={(event) => setDifficulty(event.currentTarget.value)}
          />
          <NativeSelect
            label="Διάρκεια"
            value={rounds}
            data={['5', '10', '15'].map((value) => ({ value, label: value + ' γύροι' }))}
            onChange={(event) => setRounds(event.currentTarget.value)}
          />
          <Checkbox
            label="Προεπισκόπηση (δεν αποθηκεύει πρόοδο)"
            checked={preview}
            onChange={(event) => setPreview(event.currentTarget.checked)}
          />
          <Button
            disabled={!profileId || !activeDeck || !DECKS_BY_ID.has(activeDeck)}
            onClick={() => {
              localStorage.setItem('activeKidsProfileId', profileId)
              const query = new URLSearchParams({
                profile: profileId,
                difficulty,
                rounds,
                ...(preview ? { preview: 'true' } : {}),
              })
              void navigate('/kids/play/' + mode + '/' + activeDeck + '?' + query.toString())
            }}
          >
            Έναρξη
          </Button>
        </Stack>
      </Card>
    </div>
  )
}
