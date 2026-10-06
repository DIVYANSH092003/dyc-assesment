import { cn } from '@/lib/utils'

export function Card({
  id,
  className,
  children,
}: {
  id?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'danger' | 'accent' | 'primary'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-secondary text-secondary-foreground',
    success: 'bg-emerald-100 text-emerald-800',
    danger: 'bg-destructive/10 text-destructive',
    accent: 'bg-accent/20 text-accent-foreground',
    primary: 'bg-primary/10 text-primary',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium">{children}</span>
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-ring/50 transition focus:border-ring focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-ring/50 transition focus:border-ring focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-ring/50 transition focus:border-ring focus:ring-2',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
