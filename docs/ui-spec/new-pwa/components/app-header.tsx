interface AppHeaderProps {
  completed: number
  total: number
}

export function AppHeader({ completed, total }: AppHeaderProps) {
  const progress = Math.round((completed / total) * 100)

  return (
    <header className="relative z-10 shrink-0 border-b border-border/40 px-6 pt-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-lg font-bold tracking-tight text-foreground"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Move Re
          </h1>
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase mt-0.5">
            {'리셋 맵'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {'4주'} <span className="mx-1 text-border">{'|'}</span> {'20세션'}
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            {`${progress}%`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-[3px] w-full bg-border/60 overflow-hidden rounded-full">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  )
}
