import type { PersonStatus } from '../../types/person'

export function StatusBadge({ status }: { status: PersonStatus }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}
