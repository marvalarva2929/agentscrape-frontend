import type { AgentInfo } from '../../types/run'

/**
 * Who is working on what. Fed by the heartbeat's roster, so it is right after a
 * reload or a reconnect, and by the step events between heartbeats.
 */
export function AgentPanel({ agents, finished }: { agents: AgentInfo[]; finished: boolean }) {
  return (
    <section className="agent-panel" aria-label="Agents">
      <div className="activity-feed-header">
        <h3>Agents</h3>
        {!finished && <span className="muted">{agents.length} working</span>}
      </div>
      {agents.length === 0 ? (
        <p className="activity-empty">
          {finished ? 'No agent is working: the crawl has ended.' : 'No agent is working yet.'}
        </p>
      ) : (
        <ul className="agent-list">
          {agents.map((agent) => <AgentRow key={agent.id} agent={agent} />)}
        </ul>
      )}
    </section>
  )
}

function AgentRow({ agent }: { agent: AgentInfo }) {
  const budget = agent.stepBudget ?? 0
  const steps = agent.stepsTaken ?? 0
  const percent = budget > 0 ? Math.min(100, Math.round((steps / budget) * 100)) : 0
  return (
    <li className="agent-row">
      <div className="agent-title">
        <strong>{agent.id}</strong>
        {agent.domain && <span className="muted">{agent.domain}</span>}
      </div>
      <div className="agent-action">{agent.message ?? 'Starting…'}</div>
      {agent.url && (
        <a href={agent.url} target="_blank" rel="noreferrer" className="activity-url">{agent.url}</a>
      )}
      {budget > 0 && (
        <div className="agent-steps" title={`${steps.toLocaleString()} of ${budget.toLocaleString()} pages`}>
          <div className="agent-steps-bar"><div style={{ width: `${percent}%` }} /></div>
          <span className="muted">{steps.toLocaleString()} / {budget.toLocaleString()} pages</span>
        </div>
      )}
    </li>
  )
}
