import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Brand({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/dyc-logo.svg"
        alt="DYC Global logo"
        width={160}
        height={160}
        className="h-10 w-10 shrink-0 rounded-full"
      />
    </div>
  )
}
