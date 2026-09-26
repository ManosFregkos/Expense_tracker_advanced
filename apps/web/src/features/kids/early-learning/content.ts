import type { EuropeanCountry, FingerQuantityAsset } from './types'

export const GREEK_NUMBER_WORDS = {
  1: 'ένα', 2: 'δύο', 3: 'τρία', 4: 'τέσσερα', 5: 'πέντε',
} as const

export const FINGER_ASSETS: readonly FingerQuantityAsset[] = [1, 2, 3, 4, 5].map((quantity) => ({
  id: `finger-quantity-${quantity}`,
  quantity: quantity as 1 | 2 | 3 | 4 | 5,
  assetId: `fingers-${quantity}`,
  narration: `${GREEK_NUMBER_WORDS[quantity as 1 | 2 | 3 | 4 | 5]} δάχτυλα`,
}))

export const COUNT_OBJECTS = [
  { id: 'object-apple', singularEl: 'μήλο', pluralEl: 'μήλα' },
  { id: 'object-ball', singularEl: 'μπάλα', pluralEl: 'μπάλες' },
  { id: 'object-star', singularEl: 'αστέρι', pluralEl: 'αστέρια' },
  { id: 'object-fish', singularEl: 'ψάρι', pluralEl: 'ψάρια' },
  { id: 'object-flower', singularEl: 'λουλούδι', pluralEl: 'λουλούδια' },
] as const

export const EUROPEAN_COUNTRIES: readonly EuropeanCountry[] = [
  { id: 'country-gr', iso2: 'GR', nameEl: 'Ελλάδα', nameEn: 'Greece', genitiveEl: 'Ελλάδας', flagAssetId: 'flag-gr', difficultyTier: 1, enabled: true },
  { id: 'country-it', iso2: 'IT', nameEl: 'Ιταλία', nameEn: 'Italy', genitiveEl: 'Ιταλίας', flagAssetId: 'flag-it', difficultyTier: 1, similarFlagCountryIds: ['country-ie'], enabled: true },
  { id: 'country-fr', iso2: 'FR', nameEl: 'Γαλλία', nameEn: 'France', genitiveEl: 'Γαλλίας', flagAssetId: 'flag-fr', difficultyTier: 1, similarFlagCountryIds: ['country-ro'], enabled: true },
  { id: 'country-de', iso2: 'DE', nameEl: 'Γερμανία', nameEn: 'Germany', genitiveEl: 'Γερμανίας', flagAssetId: 'flag-de', difficultyTier: 1, enabled: true },
  { id: 'country-es', iso2: 'ES', nameEl: 'Ισπανία', nameEn: 'Spain', genitiveEl: 'Ισπανίας', flagAssetId: 'flag-es', difficultyTier: 1, enabled: true },
  { id: 'country-pt', iso2: 'PT', nameEl: 'Πορτογαλία', nameEn: 'Portugal', genitiveEl: 'Πορτογαλίας', flagAssetId: 'flag-pt', difficultyTier: 1, enabled: true },
  { id: 'country-se', iso2: 'SE', nameEl: 'Σουηδία', nameEn: 'Sweden', genitiveEl: 'Σουηδίας', flagAssetId: 'flag-se', difficultyTier: 1, similarFlagCountryIds: ['country-fi', 'country-dk', 'country-no'], enabled: true },
  { id: 'country-pl', iso2: 'PL', nameEl: 'Πολωνία', nameEn: 'Poland', genitiveEl: 'Πολωνίας', flagAssetId: 'flag-pl', difficultyTier: 1, similarFlagCountryIds: ['country-at'], enabled: true },
  { id: 'country-fi', iso2: 'FI', nameEl: 'Φινλανδία', nameEn: 'Finland', genitiveEl: 'Φινλανδίας', flagAssetId: 'flag-fi', difficultyTier: 2, similarFlagCountryIds: ['country-se', 'country-dk', 'country-no'], enabled: true },
  { id: 'country-dk', iso2: 'DK', nameEl: 'Δανία', nameEn: 'Denmark', genitiveEl: 'Δανίας', flagAssetId: 'flag-dk', difficultyTier: 2, similarFlagCountryIds: ['country-se', 'country-fi', 'country-no'], enabled: true },
  { id: 'country-no', iso2: 'NO', nameEl: 'Νορβηγία', nameEn: 'Norway', genitiveEl: 'Νορβηγίας', flagAssetId: 'flag-no', difficultyTier: 2, similarFlagCountryIds: ['country-se', 'country-fi', 'country-dk'], enabled: true },
  { id: 'country-be', iso2: 'BE', nameEl: 'Βέλγιο', nameEn: 'Belgium', genitiveEl: 'Βελγίου', flagAssetId: 'flag-be', difficultyTier: 2, similarFlagCountryIds: ['country-ro'], enabled: true },
  { id: 'country-at', iso2: 'AT', nameEl: 'Αυστρία', nameEn: 'Austria', genitiveEl: 'Αυστρίας', flagAssetId: 'flag-at', difficultyTier: 2, similarFlagCountryIds: ['country-pl'], enabled: true },
  { id: 'country-ie', iso2: 'IE', nameEl: 'Ιρλανδία', nameEn: 'Ireland', genitiveEl: 'Ιρλανδίας', flagAssetId: 'flag-ie', difficultyTier: 2, similarFlagCountryIds: ['country-it'], enabled: true },
  { id: 'country-ua', iso2: 'UA', nameEl: 'Ουκρανία', nameEn: 'Ukraine', genitiveEl: 'Ουκρανίας', flagAssetId: 'flag-ua', difficultyTier: 2, enabled: true },
  { id: 'country-ch', iso2: 'CH', nameEl: 'Ελβετία', nameEn: 'Switzerland', genitiveEl: 'Ελβετίας', flagAssetId: 'flag-ch', difficultyTier: 2, enabled: true },
  { id: 'country-cz', iso2: 'CZ', nameEl: 'Τσεχία', nameEn: 'Czechia', genitiveEl: 'Τσεχίας', flagAssetId: 'flag-cz', difficultyTier: 2, enabled: true },
  { id: 'country-ro', iso2: 'RO', nameEl: 'Ρουμανία', nameEn: 'Romania', genitiveEl: 'Ρουμανίας', flagAssetId: 'flag-ro', difficultyTier: 2, similarFlagCountryIds: ['country-fr', 'country-be'], enabled: true },
  { id: 'country-nl', iso2: 'NL', nameEl: 'Ολλανδία', nameEn: 'Netherlands', genitiveEl: 'Ολλανδίας', flagAssetId: 'flag-nl', difficultyTier: 3, similarFlagCountryIds: ['country-lu'], enabled: true },
  { id: 'country-lu', iso2: 'LU', nameEl: 'Λουξεμβούργο', nameEn: 'Luxembourg', genitiveEl: 'Λουξεμβούργου', flagAssetId: 'flag-lu', difficultyTier: 3, similarFlagCountryIds: ['country-nl'], enabled: true },
]

export const countryById = new Map(EUROPEAN_COUNTRIES.map((country) => [country.id, country]))

export function countryTeachingNarration(country: EuropeanCountry) {
  return `Αυτή είναι η σημαία της ${country.genitiveEl}. ${country.nameEl}.`
}

export function validateEuropeanCountries(assetIds: ReadonlySet<string>) {
  const ids = new Set<string>()
  const isoCodes = new Set<string>()
  for (const country of EUROPEAN_COUNTRIES) {
    if (ids.has(country.id) || isoCodes.has(country.iso2)) throw new Error('Duplicate European country data.')
    if (!assetIds.has(country.flagAssetId)) throw new Error(`Missing asset ${country.flagAssetId}.`)
    ids.add(country.id); isoCodes.add(country.iso2)
  }
  for (const country of EUROPEAN_COUNTRIES)
    for (const similarId of country.similarFlagCountryIds ?? [])
      if (!ids.has(similarId)) throw new Error(`Unknown similar flag ${similarId}.`)
}
