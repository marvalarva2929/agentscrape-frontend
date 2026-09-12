import type { AgentActivity } from '../../types/run'

export function AgentActivityCard({ activity }: { activity: AgentActivity }) {
  return (
    <div className="panel-block">
      <div className="panel-header">
        <h3>Agent Activity</h3>
      </div>
      <div className="meta-list">
        <div><span>Current page</span><strong>{activity.currentPage ?? '—'}</strong></div>
        <div><span>Current action</span><strong>{activity.currentAction ?? '—'}</strong></div>
        <div><span>Step</span><strong>{activity.stepNumber ?? '—'}</strong></div>
        <div><span>Records found so far</span><strong>{activity.recordsFound ?? 0}</strong></div>
      </div>
    </div>
  )
}
