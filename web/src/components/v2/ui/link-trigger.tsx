import { Link } from '@tanstack/react-router'
import type { NavigateOptions } from '@tanstack/react-router'

export function LinkTrigger({
  children,
  url,
  params,
  searchParams,
}: {
  children: React.ReactNode
  url: NavigateOptions['to']
  params?: NavigateOptions['params']
  searchParams?: NavigateOptions['search']
}) {
  return (
    <Link to={url} params={params} search={searchParams}>
      {children}
    </Link>
  )
}
