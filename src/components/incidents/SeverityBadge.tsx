import { Badge } from '@/components/ui'
import {
  SEVERITY_LABELS,
  severityBadgeVariant,
  type IncidentSeverity,
} from '@/lib/incidents'

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <Badge variant={severityBadgeVariant(severity)}>{SEVERITY_LABELS[severity]}</Badge>
}
