import { defineSecret } from 'firebase-functions/params'

export const saltEdgeAppId = defineSecret('SALTEDGE_APP_ID')
export const saltEdgeSecret = defineSecret('SALTEDGE_SECRET')
export const saltEdgePrivateKey = defineSecret('SALTEDGE_PRIVATE_KEY')

export const openBankingCredentialSecrets = [saltEdgeAppId, saltEdgeSecret]
export const openBankingSecrets = [...openBankingCredentialSecrets, saltEdgePrivateKey]
