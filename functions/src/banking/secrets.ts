import { defineSecret } from 'firebase-functions/params'

export const saltEdgeAppId = defineSecret('SALTEDGE_APP_ID')
export const saltEdgeSecret = defineSecret('SALTEDGE_SECRET')
export const openBankingSecrets = [saltEdgeAppId, saltEdgeSecret]
