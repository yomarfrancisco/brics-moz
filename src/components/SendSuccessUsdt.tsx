import { useState, useMemo } from "react"

import { Check, Copy } from "lucide-react"

type Props = {
  amount: string | number
  to: string
  txid: string
  onDone: () => void
  onViewTronscan: (txid: string) => void
}

export default function SendSuccessUsdt({ amount, to, txid, onDone, onViewTronscan }: Props) {
  const [copied, setCopied] = useState<"to"|"txid"|null>(null)

  const amt = useMemo(() => {
    const n = typeof amount === "string" ? Number(amount) : amount
    if (!isFinite(n)) return String(amount)
    return n < 1 ? n.toFixed(6) : n.toFixed(2)
  }, [amount])

  async function copy(val: string, which: "to"|"txid") {
    try {
      await navigator.clipboard.writeText(val)
      setCopied(which)
      setTimeout(() => setCopied(null), 1200)
    } catch {}
  }

  return (
    <div className="content-container-centered">
      <div className="card" style={{ padding: '24px' }}>
        {/* Tick */}
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
          Sent {amt} USDT
        </h2>
        <p style={{ marginBottom: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(0,0,0,0.6)' }}>
          Transfer completed successfully.
        </p>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <DetailRow
            label="Sent to"
            value={to}
            copied={copied==="to"}
            onCopy={() => copy(to, "to")}
          />
          <DetailRow
            label="Transaction ID"
            value={txid}
            copied={copied==="txid"}
            onCopy={() => copy(txid, "txid")}
          />
        </div>

        {/* Buttons */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={onDone}
            className="btn btn-primary"
            style={{ width: '100%', height: '44px' }}
          >
            Done
          </button>
          <button
            onClick={() => onViewTronscan(txid)}
            className="btn btn-secondary"
            style={{ width: '100%', height: '44px' }}
          >
            View on Tronscan
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: '12px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(0,0,0,0.1)',
    }}>
      <div style={{ minWidth: '120px', paddingRight: '8px', fontSize: '14px', color: 'rgba(0,0,0,0.7)' }}>
        {label}
      </div>
      {/* value column must be shrinkable: min-w-0 enables ellipsis */}
      <div style={{ 
        minWidth: 0, 
        textAlign: 'right', 
        fontWeight: 500, 
        color: '#000',
        cursor: 'pointer',
      }}
      onClick={onCopy}
      title={value}
      >
        <span
          style={{
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
            fontFamily: 'monospace',
          }}
        >
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        style={{
          position: 'relative',
          marginLeft: '4px',
          display: 'inline-flex',
          height: '32px',
          width: '32px',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: '1px solid rgba(0,0,0,0.1)',
          background: '#fff',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fff'
        }}
      >
        <Copy size={16} />
        {/* Inline copied pill */}
        <span
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            right: '-2px',
            top: '50%',
            transform: 'translateY(-50%) translateX(100%)',
            borderRadius: '9999px',
            backgroundColor: '#000',
            padding: '2px 8px',
            fontSize: '10px',
            color: '#fff',
            opacity: copied ? 1 : 0,
            transition: 'opacity 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          Copied!
        </span>
      </button>
    </div>
  )
}
