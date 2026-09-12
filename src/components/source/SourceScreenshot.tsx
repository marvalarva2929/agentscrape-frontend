export function SourceScreenshot({ url, title }: { url: string; title: string }) {
  return (
    <div className="source-screenshot">
      <div className="browser-bar">
        <span className="dot red" />
        <span className="dot amber" />
        <span className="dot green" />
        <span className="address-bar">{url}</span>
      </div>
      <div className="screenshot-body">
        <div className="screenshot-header-box">
          <h4>{title}</h4>
        </div>
        <div className="field-highlight" style={{ top: '22%', left: '18%', width: '28%' }} />
        <div className="field-highlight" style={{ top: '32%', left: '18%', width: '24%' }} />
        <div className="field-highlight" style={{ top: '42%', left: '18%', width: '30%' }} />
        <div className="field-highlight" style={{ top: '60%', left: '18%', width: '26%' }} />
      </div>
    </div>
  )
}
