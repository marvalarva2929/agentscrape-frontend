export function MiniGameLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="secondary-button" onClick={onOpen}>Play While You Wait</button>
  )
}
