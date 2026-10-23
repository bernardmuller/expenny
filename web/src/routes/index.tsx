import { createFileRoute, redirect } from '@tanstack/react-router'

import { requireAuth } from '@/lib/auth/route-guard'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    requireAuth()
    throw redirect({ to: '/dashboard' })
  },
})
