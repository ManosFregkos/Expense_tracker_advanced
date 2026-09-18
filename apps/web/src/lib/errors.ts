import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account already uses this email.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'functions/permission-denied': 'You do not have permission to do that.',
  'functions/unauthenticated': 'Please sign in again.',
  'functions/failed-precondition': 'This action cannot be completed in the current state.',
  'functions/unavailable': 'The service is temporarily unavailable. Please retry.',
}

export function friendlyError(error: unknown): string {
  if (error instanceof FirebaseError) return MESSAGES[error.code] ?? 'Something went wrong. Please try again.'
  if (error instanceof Error && import.meta.env.DEV) return error.message
  return 'Something went wrong. Please try again.'
}
