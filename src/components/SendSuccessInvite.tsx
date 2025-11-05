import { useState } from "react"
import { Check } from "lucide-react"

type Props = {
  link: string
  onDone: () => void
}

export default function SendSuccessInvite({ link, onDone }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div className="content-container-centered">
      <div className="card" style={{ padding: '24px' }}>
        {/* Tick - same visual as USDT success */}
        <div style={{ 
          margin: '0 auto 16px', 
          display: 'flex', 
          height: '48px', 
          width: '48px', 
          alignItems: 'center', 
          justifyContent: 'center', 
          borderRadius: '50%', 
          border: '2px solid #10b981' 
        }}>
          <Check size={24} style={{ color: '#059669', strokeWidth: 3 }} />
        </div>

        {/* Title */}
        <h2 style={{ marginBottom: '4px', textAlign: 'center', fontSize: '20px', fontWeight: 600 }}>
          Invite created
        </h2>
        <p style={{ marginBottom: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(0,0,0,0.6)' }}>
          Share this link so the recipient can claim:
        </p>

        {/* Link field */}
        <div style={{
          marginBottom: '24px',
          borderRadius: '8px',
          border: '1px solid rgba(0,0,0,0.1)',
          backgroundColor: 'rgba(0,0,0,0.03)',
          padding: '8px',
        }}>
          <div 
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'rgba(0,0,0,0.8)',
              WebkitOverflowScrolling: 'touch',
            }}
            title={link}
          >
            {link}
          </div>
        </div>

        {/* Buttons: primary = Copy link, secondary = Done */}
        <div style={{ 
          marginTop: '32px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px', 
          width: '100%', 
          maxWidth: '520px', 
          margin: '32px auto 0' 
        }}>
          <button
            onClick={copy}
            style={{
              height: '48px',
              width: '100%',
              borderRadius: '9999px',
              backgroundColor: '#000',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              letterSpacing: '0.025em',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.2s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.99)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={onDone}
            style={{
              height: '48px',
              width: '100%',
              borderRadius: '9999px',
              border: '1px solid rgba(0,0,0,0.1)',
              backgroundColor: '#fff',
              color: '#000',
              fontSize: '15px',
              fontWeight: 500,
              letterSpacing: '0.025em',
              cursor: 'pointer',
              transition: 'background-color 0.2s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.99)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

