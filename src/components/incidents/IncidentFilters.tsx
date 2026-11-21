import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@/schemas/incidents-schema'
import { SEVERITY_LABELS, STATUS_LABELS } from '@/lib/incidents'

const ALL = '__all__'

export type IncidentFilterState = {
  severity: string
  status: string
}

export function IncidentFilters({
  value,
  onChange,
}: {
  value: IncidentFilterState
  onChange: (next: IncidentFilterState) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-40 space-y-1.5">
        <Label htmlFor="filter-severity">Severity</Label>
        <Select
          value={value.severity || ALL}
          onValueChange={(severity) =>
            onChange({ ...value, severity: severity === ALL ? '' : severity })
          }
        >
          <SelectTrigger id="filter-severity" aria-label="Filter by severity">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All severities</SelectItem>
            {INCIDENT_SEVERITIES.map((severity) => (
              <SelectItem key={severity} value={severity}>
                {SEVERITY_LABELS[severity]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-44 space-y-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          value={value.status || ALL}
          onValueChange={(status) =>
            onChange({ ...value, status: status === ALL ? '' : status })
          }
        >
          <SelectTrigger id="filter-status" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {INCIDENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
