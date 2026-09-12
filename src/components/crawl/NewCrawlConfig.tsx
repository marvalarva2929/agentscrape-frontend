export function NewCrawlConfig({
  startUrl,
  onStartUrlChange,
  goalMode,
  onGoalModeChange,
  peopleGoal,
  onPeopleGoalChange,
}: {
  startUrl: string
  onStartUrlChange: (value: string) => void
  goalMode: 'target' | 'everyone'
  onGoalModeChange: (value: 'target' | 'everyone') => void
  peopleGoal: number | null
  onPeopleGoalChange: (value: number | null) => void
}) {
  return (
    <>
      <div className="field-group">
        <label className="input-label">Program Start URL</label>
        <input value={startUrl} onChange={(event) => onStartUrlChange(event.target.value)} placeholder="https://school.edu/program" />
        <small>If the program already has a known URL, it is prefilled.</small>
      </div>

      <div className="field-group">
        <label className="input-label">How should the crawler know when to stop?</label>
        <div className="radio-set">
          <label>
            <input type="radio" checked={goalMode === 'target'} onChange={() => onGoalModeChange('target')} />
            <span>Target number of people</span>
          </label>
          <label>
            <input type="radio" checked={goalMode === 'everyone'} onChange={() => onGoalModeChange('everyone')} />
            <span>Find everyone — no fixed goal</span>
          </label>
        </div>

        {goalMode === 'target' ? (
          <>
            <input type="number" value={peopleGoal ?? ''} min={1} onChange={(event) => onPeopleGoalChange(Number(event.target.value) || null)} placeholder="45" />
            <small>The crawler can stop after approximately this many unique residents and fellows have been found.</small>
          </>
        ) : (
          <small>The crawler will continue exploring until it determines that it has likely found all relevant residents and fellows.</small>
        )}
      </div>
    </>
  )
}
