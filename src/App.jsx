"use client"

import { useState, useEffect } from "react"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowLeft,
  ArrowDownToLine,
  Send,
  ArrowUpFromLine,
  Landmark,
  CreditCard,
  Banknote,
} from "lucide-react"
import { getDemoUserId, getBalance, setBalance } from "./ledger"

const DEPOSIT_INFO = {
  currency: "USDT",
  referenceCode: "BRICS4DC7RB",
  bank: {
    recipient: "MULTI - INVESTIMENTOS, LDA",
    accountNumber: "20098312810001",
    accountType: "Current / Cheque",
    bankName: "BCI",
    branch: "CGDIMZMA",
  },
  notice: "Deposits may take up to 72 hours to clear. Use the exact reference above.",
}

function App() {
  const [userId, setUserId] = useState(null)
  const [balance, setBalanceState] = useState(0)
  const [view, setView] = useState("home") // 'home' | 'deposit_options' | 'deposit_eft'
  const [showWithdrawFlow, setShowWithdrawFlow] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [showSnackbar, setShowSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState("")
  const [openAccordion, setOpenAccordion] = useState(null)
  const [showCopyTooltip, setShowCopyTooltip] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [exceedsMax, setExceedsMax] = useState(false)

  // Initialize demo user and balance on mount
  useEffect(() => {
    const demoUserId = getDemoUserId()
    setUserId(demoUserId)
    const userBalance = getBalance(demoUserId)
    setBalanceState(userBalance)
  }, [])

  // Update balance in localStorage when it changes
  const updateBalance = (newBalance) => {
    if (userId) {
      setBalance(userId, newBalance)
      setBalanceState(newBalance)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text)
    setSnackbarMessage("Copied!")
    setShowSnackbar(true)
    setTimeout(() => setShowSnackbar(false), 2000)
  }

  const accordionItems = [
    {
      key: "mission",
      text: "Mission",
      submenu: [
        { text: "What is BRICS?", link: "#", disabled: false },
        { text: "Short Memo", link: "#", disabled: false },
        { text: "Rationale", link: "#", disabled: false },
      ],
    },
    {
      key: "docs",
      text: "Docs",
      submenu: [
        { text: "Long Memo", link: "#", disabled: false },
        { text: "AI + Copula", link: "#", disabled: false },
        { text: "GitHub", link: "#", disabled: false },
      ],
    },
    {
      key: "data",
      text: "Data room",
      submenu: [
        { text: "Regulatory license", link: "#", disabled: false },
        { text: "Mark-to-market", link: "#", disabled: false },
        { text: "Reserve Bank filing", link: "#", disabled: false },
      ],
    },
    {
      key: "contact",
      text: "Contact us",
      submenu: [
        { text: "Telegram", link: null, disabled: true },
        { text: "Twitter", link: null, disabled: true },
        { text: "ygor@brics.ninja", link: "mailto:ygor@brics.ninja", disabled: false },
      ],
    },
  ]

  const AboutSection = () => (
    <div className="about-section">
      <div className="about-title">About BRICS</div>
      <div className="about-items">
        {accordionItems.map((item) => (
          <div key={item.key} className="accordion-wrapper">
            <div
              className={`about-item ${openAccordion === item.key ? "active" : ""}`}
              onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)}
            >
              <div className="about-item-content">
                <div className="about-item-text">{item.text}</div>
              </div>
              {openAccordion === item.key ? (
                <ChevronUp className="chevron-icon chevron-up" size={20} />
              ) : (
                <ChevronDown className="chevron-icon chevron-down" size={20} />
              )}
            </div>
            {openAccordion === item.key && (
              <div className="submenu">
                {item.submenu.map((subItem, idx) => (
                  <div
                    key={idx}
                    className={`submenu-item ${subItem.disabled ? "disabled" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!subItem.disabled && subItem.link) {
                        window.open(subItem.link, "_blank")
                      }
                    }}
                  >
                    {subItem.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const DepositOptions = () => (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("home")}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="content-container-centered">
        <div className="card deposit-options-card">
          <div className="deposit-options-title">Deposit {DEPOSIT_INFO.currency}</div>
          <div className="deposit-options-subtitle">{balance.toFixed(2)} USDT available</div>

          <div className="deposit-options-buttons">
            <button className="option-btn" onClick={() => setView("deposit_eft")}>
              <div className="option-btn-content">
                <Landmark size={20} />
                <span>Deposit via EFT</span>
              </div>
            </button>

            <button
              className="option-btn disabled"
              aria-disabled="true"
              onClick={() => {
                setSnackbarMessage("Card deposits coming soon.")
                setShowSnackbar(true)
                setTimeout(() => setShowSnackbar(false), 2000)
              }}
            >
              <div className="option-btn-content">
                <CreditCard size={20} />
                <span>Deposit via credit or debit card</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  )

  const EFTDetails = () => (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("deposit_options")}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="content-container-centered">
        <div className="card eft-details-card">
          <div className="eft-title">Sign in to your bank and make a deposit with the following information:</div>
          <div className="eft-balance">Available: {balance.toFixed(2)} USDT</div>

          <div className="pill-ref" onClick={() => handleCopy(DEPOSIT_INFO.referenceCode)}>
            <div className="pill-ref-label">Make a deposit using the reference</div>
            <div className="pill-ref-code">{DEPOSIT_INFO.referenceCode}</div>
          </div>

          <div className="kv-list">
            <div className="kv-row">
              <div className="kv-label">Recipient</div>
              <div className="kv-value">{DEPOSIT_INFO.bank.recipient}</div>
            </div>
            <div className="kv-row">
              <div className="kv-label">Account number</div>
              <div className="kv-value">{DEPOSIT_INFO.bank.accountNumber}</div>
            </div>
            <div className="kv-row">
              <div className="kv-label">Account type</div>
              <div className="kv-value">{DEPOSIT_INFO.bank.accountType}</div>
            </div>
            <div className="kv-row">
              <div className="kv-label">Bank</div>
              <div className="kv-value">{DEPOSIT_INFO.bank.bankName}</div>
            </div>
            <div className="kv-row">
              <div className="kv-label">SWIFT</div>
              <div className="kv-value">{DEPOSIT_INFO.bank.branch}</div>
            </div>
            <div className="kv-row">
              <div className="kv-label">Reference number</div>
              <div className="kv-value kv-value-copy">
                {DEPOSIT_INFO.referenceCode}
                <Copy className="copy-icon" size={14} onClick={() => handleCopy(DEPOSIT_INFO.referenceCode)} />
              </div>
            </div>
          </div>

          <div className="muted-notice">{DEPOSIT_INFO.notice}</div>

          <button className="primary-btn" onClick={() => setView("home")}>
            CLOSE
          </button>
        </div>
      </div>
    </>
  )

  const WithdrawFlow = () => (
    <>
      <div className="top-header form-header">
        <button className="back-button" onClick={() => setShowWithdrawFlow(false)}>
          <ArrowLeft size={20} />
        </button>
        <div className="form-title">Withdraw</div>
      </div>

      <div className="content-container">
        <div className="form-container">
          <div className="form-card">
            <div className="form-group">
              <div className="form-label">Amount</div>
              <div className="input-field">
                <div className="currency-badge">
                  <div className="currency-icon">
                    <Banknote size={16} />
                  </div>
                  <div className="currency-label">{DEPOSIT_INFO.currency}</div>
                </div>
                <input
                  type="number"
                  className="amount-input"
                  value={withdrawAmount}
                  onChange={(e) => {
                    const newAmount = e.target.value
                    setWithdrawAmount(newAmount)
                    setExceedsMax(Number.parseFloat(newAmount) > depositedAmount)
                  }}
                  placeholder="0"
                />
              </div>
              <div className="max-container">
                <div className={`max-value ${exceedsMax ? "max-value-exceeded" : ""}`}>
                  {depositedAmount.toFixed(2)}
                </div>
                <button className="max-button" onClick={() => setWithdrawAmount(depositedAmount.toString())}>
                  Max
                </button>
              </div>
            </div>

            <div className="form-group">
              <div className="form-label">My wallet address</div>
              <div className="address-container">
                <div className="address-display address-display-simplified">
                  <span className="address-text">{account}</span>
                  <Copy className="copy-icon" size={14} onClick={() => handleCopy(account)} />
                </div>
                {showCopyTooltip && <div className="copy-tooltip">Copied!</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-button-container">
        <button
          className="confirm-btn"
          onClick={() => {
            setIsProcessing(true)
            setShowSnackbar(true)
            setSnackbarMessage("Withdrawal successful!")
            setTimeout(() => {
              setShowSnackbar(false)
              setShowWithdrawFlow(false)
              setDepositedAmount((prev) => prev - Number.parseFloat(withdrawAmount))
              setBricsBalance((prev) => prev - Number.parseFloat(withdrawAmount))
              setWithdrawAmount("")
              setIsProcessing(false)
            }, 2000)
          }}
          disabled={
            !withdrawAmount ||
            Number.parseFloat(withdrawAmount) <= 0 ||
            Number.parseFloat(withdrawAmount) > depositedAmount ||
            isProcessing
          }
        >
          <span>{isProcessing ? "Processing withdrawal..." : "Confirm withdrawal"}</span>
          {!isProcessing && <span>→</span>}
        </button>
      </div>
    </>
  )

  const WalletUnconnected = () => (
    <div className="content-container">
      <div className="card">
        <div className="avatar-container">
          <div className="generic-avatar">
            <svg className="generic-avatar-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
        </div>
        <div className="unconnected-balance-container">
          <div className="unconnected-balance-amount">{balance.toFixed(2)} USDT</div>
          <div className="unconnected-balance-secondary">Available balance</div>
        </div>
        <div className="unconnected-action-buttons">
          <button className="btn btn-icon btn-primary" onClick={() => setView("deposit_options")}>
            <span>Deposit</span>
            <ArrowDownToLine size={16} />
          </button>
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => {
              // TODO: Send flow (centralized) - no wallet connect
            }}
          >
            <span>Send</span>
            <Send size={16} />
          </button>
          <button className="btn btn-icon btn-secondary" onClick={() => setShowWithdrawFlow(true)}>
            <span>Withdraw</span>
            <ArrowUpFromLine size={16} />
          </button>
        </div>
      </div>
      <AboutSection />
    </div>
  )

  return (
    <div className="min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', sans-serif;
          background-color: #f5f5f5;
        }

        .min-h-screen {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }

        .app-container {
          position: relative;
          width: 100vw;
          height: 700px;
          max-width: 600px;
          overflow: hidden;
          background-color: #FAFAFA;
          border-radius: 16px;
        }

        .content-container {
          display: flex;
          flex-direction: column;
          gap: 64px;
          padding: 16px;
          position: absolute;
          top: 72px;
          width: 100%;
          padding-bottom: 100px;
          overflow-y: auto;
          max-height: calc(700px - 72px - 70px);
        }

        .header-area {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 64px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          background-color: #FAFAFA;
          z-index: 10;
        }

        .back-button-header {
          border: none;
          background: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .content-container-centered {
          position: absolute;
          top: 64px;
          left: 0;
          width: 100%;
          height: calc(100% - 64px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px 16px;
          overflow-y: auto;
        }

        .deposit-options-card {
          max-width: 500px;
          gap: 24px;
        }

        .deposit-options-title {
          font-size: 24px;
          font-weight: 700;
          color: #000;
          text-align: center;
        }

        .deposit-options-subtitle {
          font-size: 14px;
          font-weight: 400;
          color: #6B6B6B;
          text-align: center;
          line-height: 1.5;
        }

        .deposit-options-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .option-btn {
          width: 100%;
          min-height: 64px;
          background-color: white;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 16px;
          padding: 16px 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .option-btn:hover:not(.disabled) {
          border-color: rgba(0, 0, 0, 0.3);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .option-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .option-btn-content {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          font-weight: 500;
          color: #000;
        }

        .eft-details-card {
          max-width: 500px;
          gap: 20px;
        }

        .eft-title {
          font-size: 15px;
          font-weight: 400;
          color: #333;
          text-align: center;
          line-height: 1.5;
        }

        .eft-balance {
          font-size: 14px;
          font-weight: 600;
          color: #6B6B6B;
          text-align: center;
          margin-bottom: 16px;
        }

        .pill-ref {
          background-color: #F7F7F8;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .pill-ref:hover {
          background-color: #EFEFEF;
        }

        .pill-ref-label {
          font-size: 12px;
          font-weight: 500;
          color: #6B6B6B;
          text-align: center;
        }

        .pill-ref-code {
          font-size: 24px;
          font-weight: 700;
          color: #000;
          letter-spacing: 2px;
        }

        .kv-list {
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .kv-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .kv-row:last-child {
          border-bottom: none;
        }

        .kv-label {
          font-size: 14px;
          font-weight: 400;
          color: #6B6B6B;
        }

        .kv-value {
          font-size: 14px;
          font-weight: 600;
          color: #000;
          text-align: right;
        }

        .kv-value-copy {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .muted-notice {
          font-size: 13px;
          font-weight: 400;
          color: #777;
          text-align: center;
          line-height: 1.5;
          padding: 0 8px;
        }

        .primary-btn {
          width: 100%;
          max-width: 272px;
          height: 44px;
          background-color: #000;
          color: white;
          border: none;
          border-radius: 56px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease;
          margin-top: 8px;
        }

        .primary-btn:hover {
          opacity: 0.9;
        }

        .top-header {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          z-index: 10;
        }

        .bottom-button-container {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          z-index: 10;
          background-color: white;
        }

        .card {
          background-color: white;
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .card.balance-card {
          gap: 40px;
        }

        .balance-label {
          font-size: 14px;
          font-weight: 900;
          color: #000;
        }

        .avatar-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          margin-bottom: 16px;
        }

        .generic-avatar {
          width: 40px;
          height: 40px;
          background-color: #e9dff5;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .generic-avatar-icon {
          width: 40px;
          height: 40px;
          color: #6e6e6e;
        }

        .wallet-info-text {
          font-size: 16px;
          font-weight: 400;
          color: #555;
          margin-bottom: 24px;
          text-align: center;
        }

        .btn {
          border-radius: 56px;
          min-height: 36px;
          font-size: 13px;
          font-weight: 500;
          padding: 0px 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 1;
        }

        .btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: #000;
          color: white;
          border: none;
        }

        .btn-secondary {
          background-color: transparent;
          color: #000;
          border: 1px solid rgba(0, 0, 0, 0.3);
        }

        .about-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 0;
          background-color: transparent;
        }

        .about-title {
          font-size: 14px;
          font-weight: 800;
          text-align: center;
          margin-bottom: 16px;
        }

        .about-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .accordion-wrapper {
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .about-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          border-radius: 0px;
          background-color: transparent;
          margin-bottom: 4px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .about-item.active {
          background-color: rgba(0, 0, 0, 0.03);
        }

        .about-item-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .about-item-text {
          font-size: 14px;
          font-weight: 600;
          color: #000000;
        }

        .chevron-icon {
          width: 20px;
          height: 20px;
          transition: transform 0.3s ease;
        }

        .chevron-up {
          transform: rotate(180deg);
        }

        .submenu {
          overflow: hidden;
          transition: max-height 0.3s ease-in-out;
          background-color: rgba(0, 0, 0, 0.02);
        }

        .submenu-item {
          padding: 10px 16px 10px 32px;
          font-size: 13px;
          font-weight: 400;
          color: #000000;
          cursor: pointer;
          transition: background-color 0.2s ease;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .submenu-item:last-child {
          border-bottom: none;
        }

        .submenu-item:hover:not(.disabled) {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .submenu-item.disabled {
          color: rgba(0, 0, 0, 0.4);
          cursor: not-allowed;
        }

        .wallet-address-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: rgba(14, 127, 87, 0.1);
          border-radius: 24px;
          padding: 8px 24px 8px 8px;
          cursor: pointer;
        }

        .wallet-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #0e7f57;
        }

        .wallet-address {
          font-size: 12px;
          font-weight: 400;
          line-height: 14px;
          color: #333;
        }

        .network-indicator {
          position: absolute;
          right: 16px;
          top: 16px;
          display: flex;
          align-items: center;
          gap: 4px;
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 24px;
          padding: 4px 10px;
          font-size: 12px;
        }

        .network-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #0052FF;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }

        .network-name {
          font-weight: 500;
        }

        .balance-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
          gap: 0px;
        }

        .balance-amount {
          font-size: 32px;
          font-weight: 700;
          color: #000;
        }

        .profit-info {
          font-size: 12px;
          font-weight: 400;
          color: #888;
        }

        .profit-positive {
          color: #0d7e57;
          font-weight: 500;
        }

        .profit-negative {
          color: #e74c3c;
          font-weight: 500;
        }

        .action-buttons {
          display: flex;
          width: 100%;
          max-width: 320px;
          height: 36px;
          gap: 8px;
          justify-content: center;
        }

        .unconnected-balance-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
          margin-bottom: 32px;
        }

        .unconnected-balance-amount {
          font-size: 40px;
          font-weight: 700;
          color: #000;
          line-height: 1.2;
        }

        .unconnected-balance-secondary {
          font-size: 14px;
          font-weight: 400;
          color: #888;
          margin-top: 4px;
        }

        .unconnected-action-buttons {
          display: flex;
          flex-direction: row;
          width: 100%;
          gap: 8px;
          max-width: 400px;
        }

        .unconnected-action-buttons .btn {
          flex: 1;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 6px;
          min-height: 36px;
        }

        .btn-icon {
          font-size: 13px;
        }

        .btn-icon span {
          font-weight: 500;
        }

        .form-header {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 100%;
          margin-bottom: 24px;
        }

        .back-button {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: none;
          cursor: pointer;
          padding: 0;
        }

        .form-title {
          font-size: 20px;
          font-weight: 700;
          line-height: 32px;
          color: #000;
          text-align: center;
        }

        .form-container {
          width: 100%;
          padding: 0px;
        }

        .form-card {
          background-color: white;
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-group {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 700;
          line-height: 16.8px;
          color: #000;
        }

        .input-field {
          position: relative;
          width: 100%;
          height: 64px;
          border: 1px solid rgba(0, 0, 0, 0.3);
          border-radius: 8px;
        }

        .currency-badge {
          position: absolute;
          right: 16px;
          top: 16px;
          display: flex;
          align-items: center;
          gap: 4px;
          background-color: rgba(0, 182, 79, 0.1);
          border-radius: 24px;
          padding: 6px;
        }

        .currency-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: rgba(0, 182, 79, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .currency-label {
          font-size: 14px;
          font-weight: 700;
          line-height: 16.8px;
          color: #000;
        }

        .amount-input {
          position: absolute;
          left: 16px;
          top: 0;
          width: calc(100% - 90px);
          height: 100%;
          border: none;
          background: none;
          font-size: 24px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          color: #000;
          padding: 0;
          line-height: 64px;
        }

        .amount-input:focus {
          outline: none;
        }

        .amount-input::-webkit-outer-spin-button,
        .amount-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .amount-input {
          -moz-appearance: textfield;
        }

        .max-container {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 4px;
          padding-right: 16px;
        }

        .max-value {
          font-size: 12px;
          line-height: 14.4px;
          color: #000;
          transition: color 0.2s ease;
        }

        .max-value-exceeded {
          color: #e74c3c;
          font-weight: 500;
        }

        .buy-button {
          background-color: black;
          color: white;
          border: none;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 12px;
          margin-left: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .max-button {
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 16px;
          padding: 6px 8px;
          background: none;
          font-size: 12px;
          font-weight: 700;
          color: #000;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .address-container {
          width: 100%;
          min-height: 64px;
          border: 1px solid rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          background: rgba(14, 127, 87, 0.1);
          position: relative;
          display: flex;
          align-items: center;
          padding: 8px 14px;
        }

        .address-display {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
          padding: 6px;
          justify-content: space-between;
        }

        .address-display-simplified {
          padding: 6px;
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .address-text {
          font-size: 12px;
          line-height: 14.4px;
          color: #000;
          white-space: normal;
          overflow: hidden;
          text-align: left;
          flex-grow: 1;
          max-width: 90%;
          word-break: break-all;
        }

        .copy-icon {
          width: 14px;
          height: 14px;
          cursor: pointer;
          margin-left: 4px;
          color: #000;
          opacity: 0.6;
          transition: opacity 0.2s ease;
        }

        .copy-icon:hover {
          opacity: 1;
        }

        .copy-tooltip {
          position: absolute;
          bottom: -30px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          z-index: 100;
        }

        .confirm-btn {
          padding: 9px 20px;
          max-height: 36px;
          width: 272px;
          background-color: #000;
          border-radius: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          opacity: 0.3;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: white;
        }

        .confirm-btn:enabled {
          opacity: 1;
        }

        .snackbar {
          position: fixed;
          bottom: 90px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #333;
          color: white;
          padding: 12px 24px;
          border-radius: 4px;
          z-index: 1000;
          font-size: 14px;
          min-width: 200px;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
      `}</style>

      <div className="app-container">
        {view === "home" && !showWithdrawFlow && <WalletUnconnected />}
        {view === "deposit_options" && <DepositOptions />}
        {view === "deposit_eft" && <EFTDetails />}
        {showWithdrawFlow && <WithdrawFlow />}

        {showSnackbar && <div className="snackbar">{snackbarMessage}</div>}
          </div>
      </div>
  )
}

export default App