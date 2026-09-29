import { redirect } from '@tanstack/react-router'
import { hasSession } from './token-storage'

export function requireAuth() {
  if (!hasSession()) {
    throw redirect({
      to: '/login',
    })
  }
}
