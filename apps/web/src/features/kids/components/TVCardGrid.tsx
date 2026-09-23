import type { ReactNode } from 'react'

export function TVCardGrid({ children }: { children: ReactNode }) {
  const count = Array.isArray(children) ? children.length : 1
  return (
    <div className="tv-card-grid" data-count={count}>
      {children}
    </div>
  )
}
