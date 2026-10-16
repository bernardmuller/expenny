import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth/route-guard'

export const Route = createFileRoute('/archive/profile')({
  beforeLoad: () => requireAuth(),
  component: ProfileLayout,
})

function ProfileLayout() {
  return <Outlet />
}
