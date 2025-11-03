import React from 'react';

/**
 * Skeleton loader matching Deposit card height and layout.
 * Used while useWallet() is loading.
 */
export function WalletSkeleton() {
  return (
    <div className="card deposit-options-card" style={{ opacity: 0.6 }}>
      <div
        style={{
          height: '24px',
          width: '60%',
          background: '#e0e0e0',
          borderRadius: '4px',
          margin: '0 auto 8px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: '14px',
          width: '40%',
          background: '#e0e0e0',
          borderRadius: '4px',
          margin: '0 auto 24px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: '64px',
              background: '#f0f0f0',
              borderRadius: '16px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

