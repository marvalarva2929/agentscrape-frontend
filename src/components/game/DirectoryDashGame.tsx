import { useEffect, useRef, useState } from 'react'

const BOARD_WIDTH = 900
const BOARD_HEIGHT = 550
const PADDLE_WIDTH = 140
const PADDLE_HEIGHT = 14
const PADDLE_Y = BOARD_HEIGHT - 30
const MAX_ACTIVE_SPIKES = 3
const STORAGE_KEY = 'directoryDashHighScore'
const DATA_LABELS = [
  'NAME',
  'EMAIL',
  'PHONE',
  'PGY YEAR',
  'RESIDENT',
  'FELLOW',
  'SPECIALTY',
  'SCHOOL',
  'DEPARTMENT',
  'ROLE',
  'TRACK',
  'GRAD YEAR',
  'PROFILE URL',
]

type Phase = 'start' | 'playing' | 'paused' | 'ready' | 'level-complete' | 'game-over'

type Brick = {
  id: number
  x: number
  y: number
  width: number
  height: number
  label: string
  hazard: boolean
  broken: boolean
}

type Ball = {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
}

type Paddle = {
  x: number
  y: number
  width: number
  height: number
  speed: number
}

type Spike = {
  id: number
  x: number
  y: number
  width: number
  height: number
  vy: number
}

type GameState = {
  phase: Phase
  level: number
  score: number
  lives: number
  dataStreak: number
  ball: Ball
  paddle: Paddle
  bricks: Brick[]
  spikes: Spike[]
  flash: 'good' | 'bad' | 'danger' | null
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const createPaddle = (): Paddle => ({
  x: BOARD_WIDTH / 2 - PADDLE_WIDTH / 2,
  y: PADDLE_Y,
  width: PADDLE_WIDTH,
  height: PADDLE_HEIGHT,
  speed: 520,
})

const createBall = (level: number): Ball => {
  const direction = Math.random() > 0.5 ? 1 : -1
  const speed = 260 + level * 22

  return {
    x: BOARD_WIDTH / 2,
    y: BOARD_HEIGHT - 60,
    radius: 9,
    vx: direction * (130 + level * 8),
    vy: -speed,
  }
}

const createBricks = (level: number): Brick[] => {
  const columns = 6
  const rows = 5 + Math.min(level - 1, 2)
  const brickWidth = 120
  const brickHeight = 34
  const gapX = 14
  const gapY = 12
  const startX = 70
  const startY = 80
  const hazardRate = clamp(0.1 + (level - 1) * 0.05, 0.1, 0.25)

  const bricks: Brick[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = startX + col * (brickWidth + gapX)
      const y = startY + row * (brickHeight + gapY)
      const label = DATA_LABELS[(row * columns + col + level) % DATA_LABELS.length]
      const hazard = Math.random() < hazardRate

      bricks.push({
        id: row * columns + col + level * 1000,
        x,
        y,
        width: brickWidth,
        height: brickHeight,
        label,
        hazard,
        broken: false,
      })
    }
  }

  return bricks
}

const createSpike = (brick: Brick): Spike => ({
  id: Date.now() + Math.random(),
  x: brick.x + brick.width / 2 - 10,
  y: brick.y + brick.height + 4,
  width: 20,
  height: 20,
  vy: 190,
})

const createState = (level: number, score = 0, lives = 3): GameState => ({
  phase: 'start',
  level,
  score,
  lives,
  dataStreak: 0,
  ball: createBall(level),
  paddle: createPaddle(),
  bricks: createBricks(level),
  spikes: [],
  flash: null,
})

const getMultiplier = (dataStreak: number) => {
  if (dataStreak >= 10) return 4
  if (dataStreak >= 6) return 3
  if (dataStreak >= 3) return 2
  return 1
}

const formatClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function DirectoryDashGame({
  schoolName,
  status,
  peopleFound,
  emailsFound,
  onClose,
  runFinished,
  elapsedSeconds = 0,
  onViewResults,
}: {
  schoolName: string
  status: string
  peopleFound: number
  emailsFound: number
  onClose: () => void
  runFinished: boolean
  elapsedSeconds?: number
  onViewResults?: () => void
}) {
  const [game, setGame] = useState<GameState>(() => createState(1, 0, 3))
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return Number(window.localStorage.getItem(STORAGE_KEY) || '0')
  })
  const [showCompletionBanner, setShowCompletionBanner] = useState(false)
  const controls = useRef({ left: false, right: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, String(highScore))
  }, [highScore])

  useEffect(() => {
    if (runFinished) {
      setShowCompletionBanner(true)
    }
  }, [runFinished])

  useEffect(() => {
    if (game.phase !== 'ready') return

    const timer = window.setTimeout(() => {
      setGame((current) => (current.phase === 'ready' ? { ...current, phase: 'playing' } : current))
    }, 900)

    return () => window.clearTimeout(timer)
  }, [game.phase])

  useEffect(() => {
    if (game.phase !== 'level-complete') return

    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (current.phase !== 'level-complete') return current
        const nextLevel = current.level + 1
        return {
          ...current,
          phase: 'playing',
          level: nextLevel,
          ball: createBall(nextLevel),
          paddle: createPaddle(),
          bricks: createBricks(nextLevel),
          spikes: [],
          flash: null,
        }
      })
    }, 1100)

    return () => window.clearTimeout(timer)
  }, [game.phase])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        controls.current.left = true
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        controls.current.right = true
      }
      if (event.code === 'Space') {
        event.preventDefault()
        setGame((current) => {
          if (current.phase === 'start') return { ...current, phase: 'playing' }
          if (current.phase === 'playing') return { ...current, phase: 'paused' }
          if (current.phase === 'paused') return { ...current, phase: 'playing' }
          return current
        })
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        controls.current.left = false
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        controls.current.right = false
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        setGame((current) => (current.phase === 'playing' ? { ...current, phase: 'paused' } : current))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const nextHigh = Math.max(highScore, game.score)
    if (nextHigh !== highScore) {
      setHighScore(nextHigh)
    }
  }, [game.score, highScore])

  useEffect(() => {
    if (game.phase !== 'playing') return

    let frameId = 0
    let lastTime = performance.now()

    const tick = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.024)
      lastTime = time

      setGame((current) => {
        if (current.phase !== 'playing') return current

        const paddle = { ...current.paddle }
        const left = controls.current.left ? -1 : 0
        const right = controls.current.right ? 1 : 0
        const move = left + right
        if (move !== 0) {
          paddle.x = clamp(paddle.x + move * paddle.speed * delta, 16, BOARD_WIDTH - paddle.width - 16)
        }

        let ball = { ...current.ball }
        ball.x += ball.vx * delta
        ball.y += ball.vy * delta

        if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= BOARD_WIDTH) {
          ball.x = clamp(ball.x, ball.radius, BOARD_WIDTH - ball.radius)
          ball.vx *= -1
        }

        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius
          ball.vy *= -1
        }

        if (Math.abs(ball.vx) < 110) {
          ball.vx = (ball.vx === 0 ? 1 : Math.sign(ball.vx)) * 130
        }

        if (Math.abs(ball.vy) < 180) {
          ball.vy = Math.sign(ball.vy || -1) * 190
        }

        const paddleTop = paddle.y
        const paddleBottom = paddle.y + paddle.height
        const ballBottom = ball.y + ball.radius

        if (
          ballBottom >= paddleTop &&
          ballBottom <= paddleBottom + 12 &&
          ball.vy > 0 &&
          ball.x >= paddle.x &&
          ball.x <= paddle.x + paddle.width
        ) {
          const relativeHit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)
          const speed = clamp(Math.hypot(ball.vx, ball.vy) * 1.02, 260, 620)
          const newDirection = clamp(relativeHit, -1, 1)

          ball.vx = speed * 0.85 * newDirection
          if (Math.abs(ball.vx) < 120) {
            ball.vx = (newDirection >= 0 ? 1 : -1) * 150
          }
          ball.vy = -Math.abs(speed * 0.9)
          ball.y = paddleTop - ball.radius - 1
        }

        let nextBricks = current.bricks.map((brick) => ({ ...brick }))
        let hitBrick = false
        let nextDataStreak = current.dataStreak
        let nextScore = current.score
        let nextSpikes = current.spikes.map((spike) => ({ ...spike, y: spike.y + spike.vy * delta }))

        for (const brick of nextBricks) {
          if (brick.broken) continue

          const nearestX = clamp(ball.x, brick.x, brick.x + brick.width)
          const nearestY = clamp(ball.y, brick.y, brick.y + brick.height)
          const dx = ball.x - nearestX
          const dy = ball.y - nearestY

          if (dx * dx + dy * dy <= ball.radius * ball.radius) {
            brick.broken = true
            hitBrick = true
            nextDataStreak += 1
            const multiplier = getMultiplier(nextDataStreak)
            nextScore += 10 * multiplier

            if (brick.hazard && nextSpikes.length < MAX_ACTIVE_SPIKES) {
              nextSpikes = [...nextSpikes, createSpike(brick)]
            }

            const overlapLeft = Math.abs((ball.x + ball.radius) - brick.x)
            const overlapRight = Math.abs((ball.x - ball.radius) - (brick.x + brick.width))
            const overlapTop = Math.abs((ball.y + ball.radius) - brick.y)
            const overlapBottom = Math.abs((ball.y - ball.radius) - (brick.y + brick.height))
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

            if (minOverlap === overlapLeft || minOverlap === overlapRight) {
              ball.vx *= -1
            } else {
              ball.vy *= -1
            }

            break
          }
        }

        nextSpikes = nextSpikes.filter((spike) => spike.y + spike.height < BOARD_HEIGHT + 30)
        for (const spike of nextSpikes) {
          if (
            spike.y + spike.height >= paddle.y &&
            spike.x + spike.width >= paddle.x &&
            spike.x <= paddle.x + paddle.width &&
            spike.y <= paddle.y + paddle.height + 10
          ) {
            nextSpikes = nextSpikes.filter((candidate) => candidate.id !== spike.id)
            nextDataStreak = 0
            const nextLives = current.lives - 1
            if (nextLives <= 0) {
              return {
                ...current,
                phase: 'game-over',
                score: nextScore,
                dataStreak: 0,
                lives: 0,
                ball,
                paddle,
                bricks: nextBricks,
                spikes: nextSpikes,
                flash: 'danger',
              }
            }

            return {
              ...current,
              phase: 'ready',
              score: nextScore,
              lives: nextLives,
              dataStreak: 0,
              ball: createBall(current.level),
              paddle: createPaddle(),
              bricks: nextBricks,
              spikes: nextSpikes,
              flash: 'danger',
            }
          }
        }

        if (ballBottom > BOARD_HEIGHT + 20) {
          const nextLives = current.lives - 1
          if (nextLives <= 0) {
            return {
              ...current,
              phase: 'game-over',
              score: nextScore,
              lives: 0,
              dataStreak: 0,
              ball,
              paddle,
              bricks: nextBricks,
              spikes: nextSpikes,
              flash: 'bad',
            }
          }

          return {
            ...current,
            phase: 'ready',
            score: nextScore,
            lives: nextLives,
            dataStreak: 0,
            ball: createBall(current.level),
            paddle: createPaddle(),
            bricks: nextBricks,
            spikes: nextSpikes,
            flash: 'bad',
          }
        }

        if (hitBrick) {
          return {
            ...current,
            score: nextScore,
            dataStreak: nextDataStreak,
            ball,
            paddle,
            bricks: nextBricks,
            spikes: nextSpikes,
            flash: 'good',
          }
        }

        if (nextBricks.every((brick) => brick.broken)) {
          return {
            ...current,
            phase: 'level-complete',
            score: nextScore,
            dataStreak: nextDataStreak,
            ball,
            paddle,
            bricks: nextBricks,
            spikes: nextSpikes,
            flash: 'good',
          }
        }

        const brickRemoved = multiplierValue(nextBricks)
        if (brickRemoved === 0 && current.score !== nextScore) {
          return {
            ...current,
            score: nextScore,
            dataStreak: nextDataStreak,
            ball,
            paddle,
            bricks: nextBricks,
            spikes: nextSpikes,
            flash: 'good',
          }
        }

        return {
          ...current,
          ball,
          paddle,
          bricks: nextBricks,
          spikes: nextSpikes,
          flash: current.flash,
        }
      })

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [game.phase])

  const startGame = () => {
    setGame((current) => ({
      ...createState(current.level, current.score, current.lives),
      phase: 'playing',
    }))
  }

  const restartGame = () => {
    setGame(createState(1, 0, 3))
    setShowCompletionBanner(false)
  }

  const togglePause = () => {
    setGame((current) => {
      if (current.phase === 'playing') return { ...current, phase: 'paused' }
      if (current.phase === 'paused') return { ...current, phase: 'playing' }
      return current
    })
  }

  const visibleBoard = game.phase === 'start' ? createBricks(1) : game.bricks

  return (
    <div className="mini-game-shell">
      <div className="mini-game-header">
        <div className="mini-status-strip">
          <span>School: {schoolName}</span>
          <span>Stage: {status}</span>
          <span>People Found: {peopleFound}</span>
          <span>Emails Found: {emailsFound}</span>
          <span>Elapsed: {formatClock(elapsedSeconds)}</span>
        </div>
        <button className="close-button" onClick={onClose} aria-label="Close game">×</button>
      </div>

      <div className="directory-dash-toolbar">
        <div className="directory-dash-title">DIRECTORY DASH</div>
        <div className="directory-dash-controls">
          <button className="secondary-button small-button" onClick={togglePause} disabled={game.phase === 'start' || game.phase === 'game-over'}>
            {game.phase === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button className="secondary-button small-button" onClick={restartGame}>Restart</button>
        </div>
      </div>

      {runFinished && showCompletionBanner && (
        <div className="crawl-complete-banner">
          <div>
            <div className="crawl-banner-title">CRAWL COMPLETE</div>
            <div className="crawl-banner-meta">People Found: {peopleFound}</div>
            <div className="crawl-banner-meta">Emails Found: {emailsFound}</div>
          </div>
          <div className="crawl-banner-actions">
            <button className="primary-button small-button" onClick={onViewResults}>VIEW RESULTS</button>
            <button className="secondary-button small-button" onClick={() => setShowCompletionBanner(false)}>KEEP PLAYING</button>
          </div>
        </div>
      )}

      <div className={`game-board ${game.flash ?? ''}`}>
        {visibleBoard.map((brick) => (
          !brick.broken && (
            <div
              key={brick.id}
              className={`brick ${brick.hazard ? 'brick-hazard' : ''}`}
              style={{ left: `${(brick.x / BOARD_WIDTH) * 100}%`, top: `${(brick.y / BOARD_HEIGHT) * 100}%`, width: `${(brick.width / BOARD_WIDTH) * 100}%`, height: `${(brick.height / BOARD_HEIGHT) * 100}%` }}
            >
              <span className="brick-label">{brick.label}</span>
              <span className="brick-points">+10</span>
              {brick.hazard && <span className="brick-warning">⚠</span>}
            </div>
          )
        ))}

        {game.spikes.map((spike) => (
          <div
            key={spike.id}
            className="spike"
            style={{ left: `${(spike.x / BOARD_WIDTH) * 100}%`, top: `${(spike.y / BOARD_HEIGHT) * 100}%`, width: `${(spike.width / BOARD_WIDTH) * 100}%`, height: `${(spike.height / BOARD_HEIGHT) * 100}%` }}
          />
        ))}

        <div
          className="paddle"
          style={{ left: `${(game.paddle.x / BOARD_WIDTH) * 100}%`, top: `${(game.paddle.y / BOARD_HEIGHT) * 100}%`, width: `${(game.paddle.width / BOARD_WIDTH) * 100}%`, height: `${(game.paddle.height / BOARD_HEIGHT) * 100}%` }}
        />

        <div
          className="ball"
          style={{ left: `${(game.ball.x / BOARD_WIDTH) * 100}%`, top: `${(game.ball.y / BOARD_HEIGHT) * 100}%`, width: `${(game.ball.radius * 2 / BOARD_WIDTH) * 100}%`, height: `${(game.ball.radius * 2 / BOARD_HEIGHT) * 100}%` }}
        />

        {game.phase === 'start' && (
          <div className="game-overlay-card">
            <div className="game-overlay-title">DIRECTORY DASH</div>
            <div className="game-overlay-subtitle">BREAK THROUGH THE DATA WALL</div>
            <p>Break all green data bricks.<br />Dodge falling red spikes.</p>
            <div className="overlay-legend">
              <span>GREEN DATA = +10</span>
              <span>RED SPIKES = DANGER</span>
            </div>
            <button className="primary-button" onClick={startGame}>START GAME</button>
          </div>
        )}

        {game.phase === 'paused' && (
          <div className="game-overlay-card small">
            <div className="game-overlay-subtitle">PAUSED</div>
            <button className="primary-button small-button" onClick={togglePause}>RESUME</button>
          </div>
        )}

        {game.phase === 'ready' && (
          <div className="game-overlay-card small">
            <div className="game-overlay-subtitle">READY</div>
          </div>
        )}

        {game.phase === 'level-complete' && (
          <div className="game-overlay-card small">
            <div className="game-overlay-subtitle">LEVEL COMPLETE</div>
          </div>
        )}

        {game.phase === 'game-over' && (
          <div className="game-overlay-card small">
            <div className="game-overlay-subtitle">GAME OVER</div>
            <button className="primary-button small-button" onClick={restartGame}>RESTART</button>
          </div>
        )}
      </div>

      <div className="game-stats-bar">
        <div><span>SCORE</span><strong>{game.score}</strong></div>
        <div><span>HIGH SCORE</span><strong>{highScore}</strong></div>
        <div><span>LIVES</span><strong>{game.lives}</strong></div>
        <div><span>LEVEL</span><strong>{game.level}</strong></div>
        <div><span>DATA STREAK</span><strong>{game.dataStreak}</strong></div>
      </div>
    </div>
  )
}

function multiplierValue(bricks: Brick[]) {
  return bricks.filter((brick) => brick.broken).length
}
