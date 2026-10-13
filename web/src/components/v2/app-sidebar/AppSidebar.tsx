import type { AppSidebarProps } from './AppSidebar.types'
import * as AppSidebarCompound from './AppSidebar.compound'

export function AppSidebar({
  items,
  activeId,
  userName,
  defaultOpen,
  onNavigate,
}: AppSidebarProps) {
  return (
    <AppSidebarCompound.Provider defaultOpen={defaultOpen}>
      <AppSidebarCompound.Root>
        <AppSidebarCompound.Header>
          <AppSidebarCompound.Logo name="Expenny" />
        </AppSidebarCompound.Header>
        <AppSidebarCompound.Content>
          <AppSidebarCompound.Nav>
            {items.map((item) => {
              const Icon = item.icon
              const isActive = item.id === activeId

              if (item.linkProvider) {
                const LinkProvider = item.linkProvider
                return (
                  <AppSidebarCompound.NavItem key={item.id}>
                    <AppSidebarCompound.NavButton asChild isActive={isActive}>
                      <LinkProvider>
                        <Icon />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                      </LinkProvider>
                    </AppSidebarCompound.NavButton>
                  </AppSidebarCompound.NavItem>
                )
              }

              return (
                <AppSidebarCompound.NavItem key={item.id}>
                  <AppSidebarCompound.NavButton
                    isActive={isActive}
                    onClick={() => onNavigate?.(item.id)}
                  >
                    <Icon />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                  </AppSidebarCompound.NavButton>
                </AppSidebarCompound.NavItem>
              )
            })}
          </AppSidebarCompound.Nav>
        </AppSidebarCompound.Content>
        <AppSidebarCompound.Footer>
          <AppSidebarCompound.User name={userName} />
        </AppSidebarCompound.Footer>
        <AppSidebarCompound.Rail />
      </AppSidebarCompound.Root>
    </AppSidebarCompound.Provider>
  )
}
