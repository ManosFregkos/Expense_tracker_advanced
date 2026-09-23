import { useQuery } from '@tanstack/react-query'
import { kidsKeys } from '../../lib/query-keys'
import { getKidsSettings, listKidsChildProfiles, listKidsProgress } from '../../lib/repositories'
import { useHousehold } from '../households/HouseholdProvider'

export function useKidsProfiles() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: kidsKeys.profiles(household?.id ?? ''),
    queryFn: () => listKidsChildProfiles(household!.id),
    enabled: Boolean(household),
  })
}

export function useKidsSettings(profileId: string | undefined) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: kidsKeys.settings(household?.id ?? '', profileId ?? ''),
    queryFn: () => getKidsSettings(household!.id, profileId!),
    enabled: Boolean(household && profileId),
  })
}

export function useKidsProgress(profileId: string | undefined) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: kidsKeys.progress(household?.id ?? '', profileId ?? ''),
    queryFn: () => listKidsProgress(household!.id, profileId!),
    enabled: Boolean(household && profileId),
  })
}
