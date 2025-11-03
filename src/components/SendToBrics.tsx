import React, { useState } from 'react';
import { ArrowLeft, User, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../lib/useWallet';
import { useAuthGate } from '../lib/useAuthGate';
import { ErrorBoundary } from './ErrorBoundary';
import { WalletSkeleton } from './WalletSkeleton';

type SendToBricsProps = {
  setView: (v: string) => void;
};

export const SendToBrics: React.FC<SendToBricsProps> = ({ setView }) => {
  // Use hooks internally; do not rely on props for user/balance
  const { balances, loading, refresh } = useWallet();
  const { user } = useAuthGate();
  const [handle, setHandle] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const formAmount = Number(amount) || 0;
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase();
  const isValidHandle = /^[a-z0-9_]{3,15}$/.test(normalizedHandle);
  const isValid = normalizedHandle.length > 0 && isValidHandle && formAmount > 0 && !isNaN(formAmount) && formAmount <= balances.USDT;

  // Guard against invalid USDT value
  if (!isFinite(balances.USDT) || balances.USDT < 0 || loading) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("send_methods")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Send to BRICS Account</div>
        </div>
        <div className="content-container-centered">
          <WalletSkeleton />
        </div>
      </>
    );
  }

  const submit = async () => {
    if (!user) {
      setError('Not signed in');
      return;
    }

    if (formAmount > balances.USDT) {
      setError('Insufficient balance');
      return;
    }

    if (!isValidHandle) {
      setError('Invalid handle format');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      // Generate idempotency key
      const idempotencyKey = crypto.randomBytes(16).toString('hex');

      const r = await fetch('/api/internal/send/handle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          toHandle: normalizedHandle,
          amountUSDT: formAmount,
          memo: memo || undefined,
          idempotencyKey,
        }),
      });

      const json = await r.json();

      if (!json.ok) {
        // Handle specific errors
        if (json.error === 'handle_not_found') {
          setError('Handle not found. Try Send to Email or Phone.');
        } else if (json.error === 'cannot_send_to_self') {
          setError('Cannot send to your own account.');
        } else if (json.error === 'insufficient_funds') {
          setError('Insufficient balance');
        } else {
          setError(json.error || json.message || 'send_failed');
        }
        return;
      }

      setResult(json);
      // Refresh wallet data to reflect new balance
      await refresh();
    } catch (e: any) {
      setError(e.message || 'send_failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.ok) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("home")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Sent</div>
        </div>

        <div className="content-container-centered">
          <div className="centered-col">
            <div className="card">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <CheckCircle2 size={48} style={{ color: '#22c55e', marginBottom: '16px' }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
                Sent {formAmount.toFixed(2)} USDT to @{normalizedHandle}
              </h2>
              <p style={{ color: '#666', marginBottom: '24px', textAlign: 'center' }}>
                Transfer completed successfully.
              </p>
              <button className="btn btn-primary" onClick={() => setView("home")} style={{ width: '100%', marginBottom: '12px' }}>
                Done
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setResult(null);
                  setHandle('');
                  setAmount('');
                  setMemo('');
                  setError(null);
                }}
                style={{ width: '100%' }}
              >
                Send Again
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("send_methods")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Send to BRICS Account</div>
        </div>

        <div className="content-container-centered">
          <div className="page-subline">
            Available: {balances.USDT.toFixed(2)} USDT
          </div>
          {formAmount > balances.USDT && (
            <div style={{ color: '#C74242', fontSize: '12px', marginTop: '8px', marginBottom: '8px', textAlign: 'center' }}>
              Insufficient balance
            </div>
          )}

          <div className="centered-col">
            <div className="card">
              <div className="form-group">
                <div className="form-label">Recipient</div>
                <input
                  className="form-input"
                  type="text"
                  placeholder="@handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
                {handle.length > 0 && !isValidHandle && (
                  <div style={{ color: '#C74242', fontSize: '12px', marginTop: '4px' }}>
                    Handle must be 3-15 characters (letters, numbers, underscore)
                  </div>
                )}
              </div>

              <div className="form-group">
                <div className="form-label">Amount (USDT)</div>
                <input
                  className="form-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="form-label">Memo (optional)</div>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Optional message"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              {error && (
                <div style={{ color: '#C74242', fontSize: '12px', marginTop: '8px' }}>{error}</div>
              )}

              <button
                className="btn btn-primary"
                style={{ marginTop: '24px', width: '100%' }}
                disabled={submitting || !isValid || loading}
                onClick={submit}
              >
                {submitting ? 'Sending…' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </>
    </ErrorBoundary>
  );
};

