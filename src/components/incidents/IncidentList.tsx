import { Badge } from '@/components/ui'
import { useUserLookup } from 'deepspace'
import { cn } from '@/lib/utils'
import {
  formatAssigneeLabel,
  formatIncidentTime,
  type IncidentRecord,
} from '@/lib/incidents'
import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'

export function IncidentListSkeleton() {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading incidents">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function IncidentList({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: IncidentRecord[]
  selectedId: string | null
  onSelect: (recordId: string) => void
}) {
  const { getName } = useUserLookup()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">ID</th>
            <th className="px-4 py-2.5 font-medium">Title</th>
            <th className="px-4 py-2.5 font-medium">Severity</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Assignee</th>
            <th className="px-4 py-2.5 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {incidents.map((incident) => {
            const selected = incident.recordId === selectedId
            const isDemo = incident.data.source === 'synthetic'
            const assignee = formatAssigneeLabel(
              incident.data,
              incident.data.assigneeId ? getName(incident.data.assigneeId) : null,
            )
            return (
              <tr
                key={incident.recordId}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(incident.recordId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(incident.recordId)
                  }
                }}
                className={cn(
                  'cursor-pointer outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60',
                  selected && 'bg-accent',
                )}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {incident.data.displayId}
                    {isDemo && (
                      <Badge variant="outline" size="sm" className="font-sans normal-case tracking-normal">
                        Demo
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 font-medium text-foreground">
                  {incident.data.title}
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={incident.data.severity} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={incident.data.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{assignee}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatIncidentTime(incident.createdAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
