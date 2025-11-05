import React, { useMemo, useState } from "react"

import { Check, Copy } from "lucide-react"

type Props = {
  amount: string | number
  to: string
  txid: string
  onDone: () => void
  onViewTronscan: (txid: string) => void
}

export default function SendSuccessUsdt({ amount, to, txid, onDone, onViewTronscan }: Props) {
  const [copied, setCopied] = useState(false)

  const displayAmt = useMemo(() => {
    const n = typeof amount === "string" ? Number(amount) : amount
    return (Math.round(n * 1e6) / 1e6).toFixed(n < 1 ? 6 : 2)
  }, [amount])

  const copyTx = async () => {
    try {
      await navigator.clipboard.writeText(txid)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div className="content-container-centered">
      <div className="card" style={{ padding: '24px' }}>
        {/* BRICS-style tick: ring + white center + thicker check */}
        <div style={{ 
          margin: '0 auto 20px', 
          display: 'flex', 
          height: '48px', 
          width: '48px', 
          alignItems: 'center', 
          justifyContent: 'center', 
          borderRadius: '50%', 
          border: '2px solid #10b981' 
        }}>
          <div style={{ 
            display: 'flex', 
            height: '40px', 
            width: '40px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '50%', 
            backgroundColor: '#fff' 
          }}>
            <Check size={24} style={{ color: '#059669', strokeWidth: 3 }} />
          </div>
        </div>
        <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
          Sent {displayAmt} USDT
        </h2>
        <p style={{ textAlign: 'center', fontSize: '14px', color: 'rgba(0,0,0,0.6)', marginBottom: '24px' }}>
          Transfer completed successfully.
        </p>
        {/* Details (no framed box; subtle chips) */}
        <div style={{ 
          margin: '0 auto 32px', 
          display: 'grid', 
          width: '100%', 
          maxWidth: '520px', 
          gap: '8px', 
          fontSize: '14px' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            borderRadius: '8px', 
            backgroundColor: 'rgba(0,0,0,0.03)', 
            padding: '8px 12px' 
          }}>
            <span style={{ color: 'rgba(0,0,0,0.6)' }}>Sent to</span>
            <span style={{ 
              fontFamily: 'monospace', 
              color: 'rgba(0,0,0,0.8)', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              maxWidth: '70%' 
            }} title={to}>
              {to}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            borderRadius: '8px', 
            backgroundColor: 'rgba(0,0,0,0.03)', 
            padding: '8px 12px' 
          }}>
            <span style={{ color: 'rgba(0,0,0,0.6)' }}>Transaction ID</span>
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontFamily: 'monospace', 
              color: 'rgba(0,0,0,0.8)', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              maxWidth: '60%' 
            }} title={txid}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txid}</span>
              <button
                onClick={copyTx}
                style={{
                  borderRadius: '6px',
                  border: '1px solid rgba(0,0,0,0.1)',
                  padding: '4px 8px',
                  fontSize: '12px',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff'
                }}
                aria-label="Copy transaction ID"
              >
                <Copy size={14} />
              </button>
            </span>
          </div>
          {copied && <div style={{ textAlign: 'center', fontSize: '12px', color: '#059669' }}>Copied!</div>}
        </div>
        {/* Buttons: only two, stacked like your handle-success card */}
        <div style={{ 
          margin: '0 auto', 
          display: 'flex', 
          width: '100%', 
          maxWidth: '520px', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>
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
