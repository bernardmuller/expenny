import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/archive/budgets/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
