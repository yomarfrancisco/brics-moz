import { useState, useMemo } from "react"
import { Check, Copy } from "lucide-react"

type Props = {
  bankName: string
  accountHolder: string
  accountType: string
  branchCode: string
  accountNumber: string
  country: string
  amount: number
  reference: string
  onDone: () => void
  onDownloadProof: (ref: string) => void
}

export default function WithdrawSuccessBank({
  bankName,
  accountHolder,
  accountType,
  branchCode,
  accountNumber,
  country,
  amount,
  reference,
  onDone,
  onDownloadProof,
}: Props) {
  const [copied, setCopied] = useState<"accountNumber" | "reference" | null>(null)
  const [downloading, setDownloading] = useState(false)

  const amt = useMemo(() => {
    if (!isFinite(amount)) return String(amount)
    return amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)
  }, [amount])

  async function copy(val: string, which: "accountNumber" | "reference") {
    try {
      await navigator.clipboard.writeText(val)
      setCopied(which)
      setTimeout(() => setCopied(null), 1200)
    } catch {}
  }

  const handleDownloadProof = async () => {
    setDownloading(true)
    try {
      onDownloadProof(reference)
    } catch (e) {
      console.error('[WithdrawSuccessBank] Download failed:', e)
    } finally {
      setDownloading(false)
    }
  }

  // Get country name from code
  const countryName = useMemo(() => {
    const countryMap: { [key: string]: string } = {
      ZA: 'South Africa',
      MZ: 'Mozambique',
    }
    return countryMap[country] || country
  }, [country])

  return (
    <div className="content-container-centered" style={{ minWidth: 0 }}>
      <div className="card" style={{ padding: '24px', minWidth: 0 }}>
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
        <h2 style={{ marginBottom: '24px', textAlign: 'center', fontSize: '20px', fontWeight: 600 }}>
          Withdrawal submitted
        </h2>

        {/* Detail rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <DetailRow
            label="Bank"
            value={bankName}
            copied={null}
            onCopy={null}
          />
          <DetailRow
            label="Account holder"
            value={accountHolder}
            copied={null}
            onCopy={null}
          />
          <DetailRow
            label="Account type"
            value={accountType}
            copied={null}
            onCopy={null}
          />
          <DetailRow
            label="Branch code"
            value={branchCode}
            copied={null}
            onCopy={null}
          />
          <DetailRow
            label="Account number"
            value={accountNumber}
            copied={copied === "accountNumber"}
            onCopy={() => copy(accountNumber, "accountNumber")}
          />
          <DetailRow
            label="Country"
            value={countryName}
            copied={null}
            onCopy={null}
          />
          <DetailRow
            label="Amount"
            value={`${amt} USDT`}
            copied={null}
            onCopy={null}
          />
          <DetailRow
            label="Reference"
            value={reference}
            copied={copied === "reference"}
            onCopy={() => copy(reference, "reference")}
          />
        </div>

        {/* Buttons: full-width parity with BRICS handle flow */}
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
            onClick={onDone}
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
            Done
          </button>
          <button
            onClick={handleDownloadProof}
            disabled={downloading}
            style={{
              height: '48px',
              width: '100%',
              borderRadius: '9999px',
              border: '1px solid rgba(0,0,0,0.1)',
              backgroundColor: downloading ? 'rgba(0,0,0,0.05)' : '#fff',
              color: '#000',
              fontSize: '15px',
              fontWeight: 500,
              letterSpacing: '0.025em',
              cursor: downloading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s, transform 0.1s',
              opacity: downloading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!downloading) {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'
              }
            }}
            onMouseLeave={(e) => {
              if (!downloading) {
                e.currentTarget.style.backgroundColor = '#fff'
              }
            }}
            onMouseDown={(e) => {
              if (!downloading) {
                e.currentTarget.style.transform = 'scale(0.99)'
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {downloading ? 'Generating...' : 'Download proof'}
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
  copied: boolean | null
  onCopy: (() => void) | null
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
        cursor: onCopy ? 'pointer' : 'default',
      }}
      onClick={onCopy || undefined}
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
          }}
        >
          {value}
        </span>
      </div>
      {onCopy && (
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
      )}
    </div>
  )
}

