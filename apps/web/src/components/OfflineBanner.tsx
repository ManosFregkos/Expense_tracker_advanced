import { Alert } from '@mantine/core'
import { IconCloudOff } from '@tabler/icons-react'
import { useOnline } from '../hooks/useOnline'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <Alert radius={0} color="yellow" icon={<IconCloudOff size={18} />} py={6}>
      You are offline. Saved reads remain available; writes will retry when the connection returns.
    </Alert>
  )
}
