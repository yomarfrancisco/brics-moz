import React from 'react';

interface DepositCancelProps {
  setView: (v: string) => void;
}

const DepositCancel: React.FC<DepositCancelProps> = ({ setView }) => {
  return (
    <div className="confirm-banner">
      <div className="confirm-banner-content">
        <div className="confirm-banner-heading">Payment cancelled</div>
        <div className="confirm-banner-amount" style={{ fontSize: '20px', marginBottom: '16px' }}>
          Your payment was not completed.
        </div>
        <button className="confirm-banner-ok" onClick={() => setView("home")}>
          OK
        </button>
      </div>
    </div>
  );
};

export default DepositCancel;
