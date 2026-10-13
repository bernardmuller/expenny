export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-background flex min-h-screen w-screen justify-center p-4
        pt-22 pb-96 md:pb-4"
    >
      <div className="w-full max-w-xl space-y-4">{children}</div>
    </div>
  )
}
