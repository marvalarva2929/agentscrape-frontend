import { useMemo, useState } from 'react'
import { DirectorySearchConfig } from './DirectorySearchConfig'
import { NewCrawlConfig } from './NewCrawlConfig'
import { RunReview } from './RunReview'
import { RunTypeSelector } from './RunTypeSelector'

export type WizardRunType = 'directory' | 'crawl' | 'both'

export function CrawlWizard({
  schoolName,
  programName,
  defaultStartUrl,
  defaultDirectoryUrl,
  onClose,
  onSubmit,
}: {
  schoolName: string
  programName: string
  defaultStartUrl: string
  defaultDirectoryUrl: string
  onClose: () => void
  onSubmit: (payload: {
    programId: string
    runDirectorySearch: boolean
    runNewCrawl: boolean
    directoryUrl?: string
    startUrl?: string
    peopleGoal?: number | null
    noFixedGoal?: boolean
  }) => void
  programId: string
}) {
  const [runType, setRunType] = useState<WizardRunType>('both')
  const [directoryUrl, setDirectoryUrl] = useState(defaultDirectoryUrl)
  const [startUrl, setStartUrl] = useState(defaultStartUrl)
  const [goalMode, setGoalMode] = useState<'target' | 'everyone'>('target')
  const [peopleGoal, setPeopleGoal] = useState<number | null>(45)
  const [step, setStep] = useState<'selection' | 'review'>('selection')

  const canContinue = useMemo(() => {
    if (runType === 'directory') return directoryUrl.trim().length > 0
    if (runType === 'crawl') return startUrl.trim().length > 0
    return directoryUrl.trim().length > 0 && startUrl.trim().length > 0
  }, [directoryUrl, runType, startUrl])

  const goalDescription = goalMode === 'everyone' ? 'Find everyone' : `Approximately ${peopleGoal ?? 0}`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Update Program Data</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {step === 'selection' ? (
          <>
            <div className="wizard-step">What would you like to run?</div>
            <RunTypeSelector value={runType} onChange={setRunType} />

            {(runType === 'directory' || runType === 'both') && (
              <DirectorySearchConfig value={directoryUrl} onChange={setDirectoryUrl} />
            )}

            {(runType === 'crawl' || runType === 'both') && (
              <NewCrawlConfig
                startUrl={startUrl}
                onStartUrlChange={setStartUrl}
                goalMode={goalMode}
                onGoalModeChange={setGoalMode}
                peopleGoal={peopleGoal}
                onPeopleGoalChange={setPeopleGoal}
              />
            )}

            <div className="modal-actions">
              <button className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" onClick={() => setStep('review')} disabled={!canContinue}>Review</button>
            </div>
          </>
        ) : (
          <>
            <RunReview
              schoolName={schoolName}
              programName={programName}
              runType={runType}
              startUrl={startUrl}
              directoryUrl={directoryUrl}
              goalDescription={goalDescription}
            />

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setStep('selection')}>Back</button>
              <button
                className="primary-button"
                onClick={() =>
                  onSubmit({
                    programId: '',
                    runDirectorySearch: runType === 'directory' || runType === 'both',
                    runNewCrawl: runType === 'crawl' || runType === 'both',
                    directoryUrl: runType === 'directory' || runType === 'both' ? directoryUrl : undefined,
                    startUrl,
                    peopleGoal: goalMode === 'everyone' ? null : peopleGoal,
                    noFixedGoal: goalMode === 'everyone',
                  })
                }
              >
                Start Update
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
