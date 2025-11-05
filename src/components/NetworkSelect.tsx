import React from "react";

export type ChainOpt = {
  id: "TRON" | "ETHEREUM" | "SOLANA";
  label: string;
  enabled: boolean;
  note?: string; // e.g. "Coming soon"
};

const DEFAULTS: ChainOpt[] = [
  { id: "TRON",     label: "TRON (TRC-20)",    enabled: true  },
  { id: "ETHEREUM", label: "Ethereum (ERC-20)", enabled: false, note: "Coming soon" },
  { id: "SOLANA",   label: "Solana (SPL-USDT)", enabled: false, note: "Coming soon" },
];

export default function NetworkSelect({
  value, onChange, options = DEFAULTS,
}: {
  value: ChainOpt["id"];
  onChange: (v: ChainOpt["id"]) => void;
  options?: ChainOpt[];
}) {
  return (
    <div className="form-group">
      <div className="form-label">Network</div>
      <div style={{ 
        overflow: 'hidden', 
        borderRadius: '12px', 
        border: '1px solid rgba(0,0,0,0.1)', 
        backgroundColor: '#fff' 
      }}>
        {options.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              textAlign: 'left',
              background: opt.enabled ? '#fff' : 'rgba(0,0,0,0.02)',
              border: 'none',
              borderBottom: i !== options.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              cursor: opt.enabled ? 'pointer' : 'not-allowed',
              opacity: opt.enabled ? 1 : 0.6,
            }}
            onClick={() => opt.enabled && onChange(opt.id)}
            disabled={!opt.enabled}
            onMouseEnter={(e) => {
              if (opt.enabled) {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (opt.enabled) {
                e.currentTarget.style.backgroundColor = '#fff';
              }
            }}
          >
            <span>{opt.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!opt.enabled && opt.note && (
                <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{opt.note}</span>
              )}
              {opt.id === value && (
                <span style={{ 
                  marginLeft: '12px', 
                  height: '8px', 
                  width: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: '#000' 
                }} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

