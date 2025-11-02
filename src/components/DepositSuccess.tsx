import React, { useState, useEffect, useRef } from 'react';
import { getBalance, setBalance as setBalanceInStorage } from '../ledger';

type PaymentStatus = 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'TIMEOUT';

interface DepositSuccessProps {
  setView: (v: string) => void;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  balance: number;
  userId: string;
}

const DepositSuccess: React.FC<DepositSuccessProps> = ({ setView, setBalance, balance, userId }) => {
  const [status, setStatus] = useState<PaymentStatus>('PENDING');
  const [amount, setAmount] = useState<string>('');
  const appliedRef = useRef(false);

  useEffect(() => {
    // Extract ref from URL, fallback to sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    let ref = urlParams.get('ref');
    if (!ref && typeof window !== 'undefined') {
      ref = sessionStorage.getItem('payfast_ref');
      if (ref) {
        sessionStorage.removeItem('payfast_ref'); // Clean up after reading
      }
    }
    
    if (!ref) {
      setStatus('TIMEOUT');
      return;
    }

    let pollCount = 0;
    const maxPolls = 30; // 60s total (30 * 2s)
    const pollInterval = 2000; // 2 seconds

    const pollStatus = async () => {
      if (pollCount >= maxPolls) {
        setStatus('TIMEOUT');
        return;
      }

      try {
        const r = await fetch(`/api/payfast/status?ref=${encodeURIComponent(ref!)}`);
        const data = await r.json();

        if (data.status === 'COMPLETE') {
          setStatus('COMPLETE');
          setAmount(data.amount || '');
        } else if (data.status === 'CANCELLED' || data.status === 'FAILED') {
          setStatus(data.status);
        } else {
          // Still pending, poll again
          pollCount++;
          setTimeout(pollStatus, pollInterval);
        }
      } catch (e) {
        console.error('[deposit:status] poll error:', e);
        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(pollStatus, pollInterval);
        } else {
          setStatus('TIMEOUT');
        }
      }
    };

    // Start polling immediately
    pollStatus();
  }, []);

  // Increment balance exactly once when COMPLETE
  useEffect(() => {
    if (status === 'COMPLETE' && amount && !appliedRef.current) {
      const depositAmount = Number(amount);
      if (!isNaN(depositAmount) && depositAmount > 0) {
        const prev = getBalance(userId);
        const next = Number((prev + depositAmount).toFixed(2));
        setBalanceInStorage(userId, next);
        setBalance(next);
        appliedRef.current = true;
      }
    }
  }, [status, amount, userId, setBalance]);

  const getStatusMessage = () => {
    switch (status) {
      case 'COMPLETE':
        return 'Deposit confirmed';
      case 'CANCELLED':
        return 'Payment was cancelled';
      case 'FAILED':
        return 'Payment failed';
      case 'TIMEOUT':
        return 'Still pending — we\'ll update when PayFast confirms.';
      default:
        return 'Payment pending confirmation…';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'COMPLETE':
        return 'Confirmed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'FAILED':
        return 'Failed';
      case 'TIMEOUT':
        return 'Pending';
      default:
        return 'Processing';
    }
  };

  return (
    <div className="confirm-banner">
      <div className="confirm-banner-content">
        <div className="confirm-banner-heading">{status === 'COMPLETE' ? 'Payment confirmed!' : 'Payment received!'}</div>
        {status === 'COMPLETE' && amount && (
          <div className="confirm-banner-amount" style={{ fontSize: '24px', marginBottom: '16px' }}>
            +{Number(amount).toFixed(2)} USDT
          </div>
        )}
        <div className="confirm-banner-amount" style={{ fontSize: '20px', marginBottom: '16px' }}>
          {getStatusMessage()}
        </div>
        <div className="confirm-banner-detail">
          <div className="confirm-banner-label">Status</div>
          <div className="confirm-banner-value">{getStatusLabel()}</div>
        </div>
        <button className="confirm-banner-ok" onClick={() => setView("home")}>
          {status === 'COMPLETE' ? 'Back to Wallet' : 'OK'}
        </button>
      </div>
    </div>
  );
};

export default DepositSuccess;
