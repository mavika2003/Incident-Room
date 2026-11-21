import { Badge } from '@/components/ui'
import {
  STATUS_LABELS,
  statusBadgeVariant,
  type IncidentStatus,
} from '@/lib/incidents'

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>
}
