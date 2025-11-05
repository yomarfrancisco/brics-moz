import React from "react";

type Props = {
  amountUSDT: string;                 // e.g. "0.01"
  toAddress: string;                  // base58
  txid: string;
  onDone: () => void;                 // back to wallet
  onSendAgain?: () => void;           // optional
};

const short = (s: string, n = 6) =>
  s.length <= n * 2 ? s : `${s.slice(0, n)}…${s.slice(-n)}`;

export default function SendSuccessUsdt({
  amountUSDT,
  toAddress,
  txid,
  onDone,
  onSendAgain,
}: Props) {
  const tronUrl = `https://tronscan.org/#/transaction/${txid}`;
  
  const copy = async (text: string) => {
    try { 
      await navigator.clipboard.writeText(text); 
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="content-container-centered">
      <div className="card">
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ 
            display: 'flex', 
            height: '40px', 
            width: '40px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '50%', 
            backgroundColor: 'rgba(22, 163, 74, 0.1)' 
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <h1 style={{ marginBottom: '4px', textAlign: 'center', fontSize: '24px', fontWeight: 600, color: '#000' }}>
          Sent {Number(amountUSDT).toFixed(2)} USDT
        </h1>
        <p style={{ marginBottom: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(0,0,0,0.6)' }}>
          Transfer completed successfully.
        </p>
        <div style={{ 
          marginBottom: '24px', 
          borderTop: '1px solid rgba(0,0,0,0.05)', 
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          borderLeft: '1px solid rgba(0,0,0,0.1)',
          borderRight: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}>
          <Row label="Sent to" value={toAddress} mono trunc />
          <Row
            label="Transaction ID"
            value={short(txid, 10)}
            mono
            extra={
              <button
                onClick={() => copy(txid)}
                style={{ fontSize: '12px', textDecoration: 'underline', textDecorationStyle: 'dotted', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}
                aria-label="Copy transaction ID"
              >
                Copy
              </button>
            }
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Primary action */}
          <button
            onClick={onDone}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Done
          </button>
          {/* Secondary actions */}
          <a
            href={tronUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}
          >
            View on Tronscan
          </a>
          {onSendAgain && (
            <button
              onClick={onSendAgain}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Send Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label, value, mono, trunc, extra,
}: { label: string; value: string; mono?: boolean; trunc?: boolean; extra?: React.ReactNode }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      gap: '12px', 
      padding: '12px 16px',
      borderBottom: '1px solid rgba(0,0,0,0.05)'
    }}>
      <span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.6)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontSize: '14px',
            fontFamily: mono ? 'monospace' : 'inherit',
            maxWidth: trunc ? '240px' : 'none',
            overflow: trunc ? 'hidden' : 'visible',
            textOverflow: trunc ? 'ellipsis' : 'clip',
            whiteSpace: trunc ? 'nowrap' : 'normal',
          }}
          title={value}
        >
          {value}
        </span>
        {extra}
      </div>
    </div>
  );
}

