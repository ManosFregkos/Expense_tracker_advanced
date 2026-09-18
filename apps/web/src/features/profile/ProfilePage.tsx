import { Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { useState } from 'react'
import { friendlyError } from '../../lib/errors'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../auth/AuthProvider'

export function ProfilePage() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!user || !name.trim()) return
    setSaving(true)
    try {
      await updateProfile(user, { displayName: name.trim() })
      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          id: user.uid,
          email: user.email,
          displayName: name.trim(),
          locale: navigator.language,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )
      notifications.show({ color: 'teal', message: 'Profile updated.' })
    } catch (error) {
      notifications.show({ color: 'red', message: friendlyError(error) })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Profile</Title>
          <Text c="dimmed">Minimal personal information used inside your households.</Text>
        </div>
      </div>
      <Paper withBorder p="xl" maw={620}>
        <Stack>
          <TextInput
            label="Display name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <TextInput label="Email" value={user?.email ?? ''} disabled />
          <TextInput label="Locale" value={navigator.language} disabled />
          <Button loading={saving} onClick={() => void save()}>
            Save profile
          </Button>
        </Stack>
      </Paper>
    </div>
  )
}
