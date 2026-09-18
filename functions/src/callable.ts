import {
  HttpsError,
  onCall,
  type CallableOptions,
  type CallableRequest,
} from 'firebase-functions/v2/https'
import { ZodError, type ZodType } from 'zod'

const options: CallableOptions = {
  region: 'europe-west1',
  cors: true,
}

export interface Actor {
  uid: string
  email: string
  emailVerified: boolean
  displayName: string
}

export function actorFrom(request: CallableRequest<unknown>, requireVerified = true): Actor {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.')
  const email = typeof request.auth.token.email === 'string' ? request.auth.token.email : ''
  const emailVerified = request.auth.token.email_verified === true
  if (requireVerified && !emailVerified) {
    throw new HttpsError('failed-precondition', 'Verify your email before this action.')
  }
  const displayName =
    typeof request.auth.token.name === 'string' && request.auth.token.name.trim()
      ? request.auth.token.name.trim()
      : email.split('@')[0] || 'Household member'
  return { uid: request.auth.uid, email, emailVerified, displayName }
}

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpsError('invalid-argument', error.issues[0]?.message ?? 'Invalid request.')
    }
    throw error
  }
}

export function secureCallable<TInput, TOutput>(
  schema: ZodType<TInput>,
  handler: (input: TInput, actor: Actor) => Promise<TOutput>,
  requireVerified = true,
) {
  return onCall(options, async (request) => {
    const actor = actorFrom(request, requireVerified)
    return handler(parseInput(schema, request.data), actor)
  })
}
