import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Skeleton'

export function OwnerStub({ title }: { title: string }) {
  return (
    <PageWrapper title={title}>
      <div className="flex flex-col gap-4 max-w-4xl">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </PageWrapper>
  )
}
