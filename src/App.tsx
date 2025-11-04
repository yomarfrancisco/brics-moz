"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
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
  Search,
  Mail,
  Wallet,
  User2,
  User,
  ChevronRight,
} from "lucide-react"
import { getDemoUserId, getBalance, setBalance as setBalanceInStorage, DEMO_MODE } from "./ledger"
import { getEmbedParams, saveMember, loadMember, validSig } from "./embed-utils"
import { useAuthGate } from "./lib/useAuthGate"
import { useWallet } from "./lib/useWallet"
import AuthScreen from "./components/AuthScreen"
import GoogleHandoff from "./components/GoogleHandoff"
import DebugEnv from "./components/__DebugEnv"
import { AvatarUploader } from "./components/AvatarUploader"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { WalletSkeleton } from "./components/WalletSkeleton"
import { SendToBrics } from "./components/SendToBrics"

const formatAccountNumber = (raw = "") => {
  const s = String(raw).replace(/\D/g, "") // digits only
  return s.replace(/(.{4})(?=.)/g, "$1\u2009")
}

const sanitizeDigits = (s: string) => s.replace(/\D/g, "")

const formatAccountNumberForDisplay = (raw: string) => {
  const digits = sanitizeDigits(raw)
  return digits.replace(/(.{4})(?=.)/g, "$1\u2009")
}

const BANKS_ZA = [
  "ABSA Bank",
  "Capitec Bank",
  "FNB/RMB",
  "Nedbank",
  "Standard Bank",
  "African Bank",
  "Albaraka Bank",
  "Access Bank",
  "Bank Zero",
  "Bidvest Bank",
  "BNP Paribas",
  "CitiBank",
  "Discovery Bank",
  "FinBond Mutual Bank",
  "African Bank Business",
  "HBZ Bank",
  "HSBC",
  "Habib Overseas Bank",
  "Investec Bank",
  "Ithala",
  "JPMorgan Chase Bank",
  "Lesotho Post Bank",
  "Olympus Mobile",
  "Peoples Bank Ltd Inc NBS",
  "Postbank",
  "S.A. Reserve Bank",
  "Sasfin Bank",
  "Societe Generale",
  "Standard Chartered Bank",
  "State Bank of India",
  "TymeBank",
  "UBank Limited",
  "Unibank",
  "Capitec Business",
]

// TODO: Add Mozambique banks when available
const BANKS_MZ = BANKS_ZA // Placeholder

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

const STYLES = `
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
  flex-direction: column;
  align-items: center;        /* center the column */
  justify-content: flex-start;
  padding: 24px 16px;
  overflow-y: auto;
  gap: 16px;                  /* tighter rhythm */
}

/* Add centered-col wrapper for card centering */
.centered-col {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  margin-bottom: 20px;
}

.pill-ref:hover {
  background-color: #EFEFEF;
}

.pill-ref-label {
  font-size: 11px;
  font-weight: 500;
  color: #7A7A7A;
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
  margin-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding-top: 8px;
}

.kv-list.notop {
  border-top: none;
  padding-top: 0;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.kv-row:last-child {
  border-bottom: none;
}

.kv-label {
  font-size: 13px;
  font-weight: 400;
  color: #6B6B6B;
}

/* Updated kv-value to include flex and gap for inputs */
.kv-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kv-value {
  font-size: 13px;
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
  font-size: 12px;
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

/* Update card with Safari flex fix properties */
.card {
  width: 100%;
  max-width: 560px;
  align-self: stretch;    /* key for Safari flex quirks */
  min-width: 0;           /* prevent intrinsic shrink */
  background-color: white;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin: 0 auto; /* make cards auto-center if container changes */
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

.wallet-header-centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  margin-bottom: 16px;
}

.wallet-handle {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.55);
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

/* Mobile responsive styles - stack buttons vertically on mobile */
@media (max-width: 640px) {
  .unconnected-action-buttons {
    flex-direction: column;
    max-width: 100%;
  }

  .unconnected-action-buttons .btn {
    width: 100%;
    min-height: 44px;
  }
}

/* Updated content-container-form to remove sticky footer height */
.content-container-form {
  position: absolute;
  top: 64px;
  left: 0;
  width: 100%;
  height: calc(100% - 64px);
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  gap: 16px;
}

/* Added inline input/select styles for line-based fields */
.line-input,
.line-select {
  border: none;
  background: transparent;
  font: inherit;
  color: #000;
  height: 24px;
  padding: 0;
  text-align: right;
  flex: 1;
}

.line-input::placeholder {
  color: #9A9A9A;
}

.line-input:focus,
.line-select:focus {
  outline: none;
}

.kv-link {
  color: #000;
  opacity: 0.75;
  cursor: pointer;
}

.field-error-row {
  font-size: 12px;
  color: #e74c3c;
  text-align: right;
  margin-top: -8px;
  margin-bottom: 8px;
  padding: 0 0 4px 0;
}

/* Added monospace utility class */
.monospace,
.monospace * {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: 0.02em;
}

/* Added styles for withdraw flow */
.picker-title {
  font-size: 18px;
  font-weight: 600;
  color: #000;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.content-container-picker {
  position: absolute;
  top: 64px;
  left: 0;
  width: 100%;
  height: calc(100% - 64px);
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  gap: 16px;
}

.form-balance-pill {
  font-size: 13px;
  font-weight: 400;
  color: #6B6B6B;
  text-align: center;
  padding: 8px 0;
}

.withdraw-form-card {
  gap: 20px;
  padding: 20px;
}

.form-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inline-action {
  font-size: 13px;
  font-weight: 600;
  color: #000;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.inline-action:hover {
  opacity: 1;
}

.form-input {
  width: 100%;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  color: #000;
  background-color: white;
}

.form-input:focus {
  outline: none;
  border-color: rgba(0, 0, 0, 0.4);
}

.form-input::placeholder {
  color: #999;
}

select.form-input {
  cursor: pointer;
}

/* Added clickable form-input style for bank picker */
.form-input-clickable {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #999;
}

.form-input-clickable:hover {
  border-color: rgba(0, 0, 0, 0.3);
}


.field-error {
  font-size: 12px;
  color: #e74c3c;
  margin-top: 4px;
}

.picker-search-container {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
}

.picker-search {
  width: 100%;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 0 14px 0 40px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  color: #000;
  background-color: white;
}

.picker-search:focus {
  outline: none;
  border-color: rgba(0, 0, 0, 0.3);
}

.bank-list {
  display: flex;
  flex-direction: column;
}

.list-item {
  min-height: 52px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 14px;
  font-weight: 400;
  color: #000;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.list-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.list-item:last-child {
  border-bottom: none;
}

/* Added confirmation card styles */
.confirm-card {
  max-width: 500px;
  gap: 16px;
  padding: 24px;
}

.confirm-title {
  font-size: 20px;
  font-weight: 800;
  color: #1A1A1A;
  text-align: left;
  width: 100%;
  margin-bottom: 8px;
}

.confirm-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.confirm-block:last-child {
  border-bottom: none;
}

.confirm-label {
  font-size: 13px;
  font-weight: 500;
  color: #6B6B6B;
}

.confirm-value {
  font-size: 24px;
  font-weight: 700;
  color: #111111;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: 0.02em;
}

/* Added Valor-style dark confirmation screen styles */
/* ---- Withdraw confirmation (Valor layout, dark theme) ---- */
.confirm-screen {
  position: absolute;
  inset: 0;
  background: #111;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.confirm-screen .header-area {
  background: transparent;
  color: #fff;
}

.confirm-body {
  padding: 24px 20px 0 20px;
}

.confirm-headline {
  font-size: 28px;
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: 0.2px;
  margin: 8px 0 28px 0;
  color: #fff;
}

.confirm-section {
  margin-bottom: 22px;
}

.confirm-section .confirm-label {
  font-size: 13px;
  font-weight: 600;
  color: #A3A3A3;
  margin-bottom: 8px;
}

.confirm-value-amount {
  font-size: 40px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: #fff;
}

.confirm-section .confirm-value {
  font-size: 28px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: #fff;
}

.confirm-section .confirm-value.mono {
  letter-spacing: 0.02em;
  color: #EDEDED;
}

.confirm-footer {
  margin-top: auto;
  padding: 0 20px 32px 20px;
  display: flex;
  justify-content: center;
}

.confirm-ok {
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.6px;
  opacity: 0.95;
  cursor: pointer;
  padding: 12px 24px;
}

.confirm-ok:active {
  opacity: 0.7;
}

/* ===== Fullscreen Confirmation Banner (Valor-style) ===== */
.confirm-banner {
  position: fixed;
  inset: 0;
  background-color: #290019;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}

.confirm-banner-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 10vh 8vw;
  color: #fff;
}

.confirm-banner-headline {
  font-size: 28px;
  font-weight: 300;
  letter-spacing: 0.3px;
  line-height: 1.3;
  margin-bottom: 48px;
}

.confirm-banner-section {
  margin-bottom: 32px;
}

.confirm-banner-label {
  font-size: 13px;
  font-weight: 300;
  opacity: 0.9;
  margin-bottom: 6px;
}

.confirm-banner-value-amount {
  font-size: 38px;
  font-weight: 300;
  letter-spacing: 0.5px;
}

.confirm-banner-value {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.4px;
}

.confirm-banner-ok {
  margin-top: auto;
  align-self: center;
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 0.6px;
  opacity: 0.95;
  cursor: pointer;
  padding-bottom: 32px;
}

.confirm-banner-ok:active {
  opacity: 0.75;
}

/* ===== Bottom Sheet ===== */
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.bottom-sheet {
  background: white;
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;
}

.bottom-sheet-full {
  background: white;
  width: 100%;
  height: 100vh;
  overflow-y: auto;
}

.bottom-sheet-handle {
  width: 40px;
  height: 4px;
  background: #E5E5E5;
  border-radius: 2px;
  margin: 0 auto 16px;
}

.bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #E5E5E5;
}

.bottom-sheet-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.bottom-sheet-list {
  display: flex;
  flex-direction: column;
}

.bottom-sheet-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #F5F5F5;
  cursor: pointer;
  transition: background 0.2s;
}

.bottom-sheet-item:hover {
  background: #F9F9F9;
}

.bottom-sheet-item:last-child {
  border-bottom: none;
}

/* Added send flow styles */
.confirm-banner-heading {
  font-size: 28px;
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: 0.2px;
  margin: 8px 0 28px 0;
  color: #fff;
}

.confirm-banner-amount {
  font-size: 40px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: #fff;
  margin-bottom: 28px;
}

.confirm-banner-detail {
  margin-bottom: 16px;
}

.confirm-banner-detail .confirm-banner-label {
  font-size: 13px;
  font-weight: 600;
  color: #A3A3A3;
  margin-bottom: 6px;
}

.confirm-banner-detail .confirm-banner-value {
  font-size: 20px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: #fff;
}

/* Updated clickable input to match form-input styling */
.form-input-clickable {
  width: 100%;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  color: #000;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.form-input-clickable:hover {
  border-color: rgba(0,0,0,0.3);
}

/* Added page subline helper for balance display */
.page-subline {
  display: block;
  width: 100%;
  max-width: 720px;
  margin: 0 auto 8px auto;
  text-align: center;
  font-size: 13px;
  font-weight: 400;
  color: #6B6B6B;
}

/* Added CSS variable for confirmation banner color */
:root {
  --confirm-banner-bg: #0025ff;  /* BRICS BLUE */
}

.confirm-banner {
  position: fixed;
  inset: 0;
  background-color: var(--confirm-banner-bg);
  display: flex;
  align-items: stretch;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}

.confirm-banner-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 10vh clamp(16px, 6vw, 64px);
  color: #fff;
}

.confirm-banner-heading {
  font-size: 24px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin: 0 0 32px 0;
  color: #fff;
}

.confirm-banner-amount {
  font-size: 36px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #fff;
  margin: 0 0 24px 0;
}

.confirm-banner-detail {
  margin-bottom: 16px;
}

.confirm-banner-label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 4px;
}

.confirm-banner-value {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  word-break: break-all;
}

.confirm-banner-ok {
  margin-top: auto;
  align-self: center;
  background: none;
  border: 1px solid rgba(255,255,255,0.6); /* add subtle border */
  border-radius: 24px;
  padding: 10px 22px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.4px;
  cursor: pointer;
  opacity: 0.95;
}

.confirm-banner-ok:active {
  opacity: 0.75;
}

/* Card rhythm */
.card { gap: 16px; }

/* Content wrappers — balanced rhythm */
.content-container-centered { padding: 24px 16px; }
.content-container { gap: 24px; }              /* was 64px — too airy */
.form-card { gap: 20px; padding: 20px; }       /* match Withdraw */

/* Labels / values */
.form-label       { font-size: 14px; font-weight: 600; color: #000; }
.kv-label         { font-size: 12px; font-weight: 500; color: #6B6B6B; }
.kv-value         { font-size: 14px; font-weight: 600; color: #000; }

/* Review table address readability */
.kv-value.mono    { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; letter-spacing: 0.02em; }
.kv-row .kv-value.address { word-break: break-all; }

/* Headers */
.picker-title     { font-size: 18px; font-weight: 600; }

/* Buttons breathing room */
.btn.btn-primary  { height: 40px; }

/* Embed mode styles */
html, body, #__next, .app-root, .embed-root { 
  height: 100%; 
}

.embed-root { 
  background: transparent; 
  overflow: hidden; 
}

.embed-close {
  position: fixed;
  top: 12px; 
  right: 12px;
  z-index: 1000;
  width: 32px; 
  height: 32px;
  border: 1px solid rgba(0,0,0,.1);
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: background-color 0.2s ease;
}

.embed-close:hover {
  background: #f5f5f5;
}

[data-embed="1"] .site-header, 
[data-embed="1"] .site-footer {
  display: none;
}

`

// Added Send flow types and constants
type SendFlow = {
  address: string
  network: "ethereum" | "tron" | "solana" | ""
  amount: string
  recipientType: "individual" | "corporate" | ""
  recipientName: string
  walletType: "csp" | "self_hosted" | ""
  provider: string
}

const CRYPTO_PROVIDERS = [
  "ABCC",
  "ACE Exchange",
  "AnchorUSD",
  "Binance",
  "Bitfinex",
  "Bitstamp",
  "Coinbase",
  "Crypto.com",
  "FTX",
  "Gemini",
  "Huobi",
  "Kraken",
  "Kraken Australia",
  "KuCoin",
  "Luno.com (prev. BitX)",
  "OKX",
  "Poloniex",
  "WOO Network",
].sort()

type Withdraw = {
  bank: string
  amount: string
  holder: string
  accountType: string
  branchCode: string
  accountNumberRaw: string
  country: "ZA" | "MZ" | string
}

type BankPickerProps = {
  withdraw: Withdraw
  setWithdraw: React.Dispatch<React.SetStateAction<Withdraw>>
  bankSearch: string
  setBankSearch: React.Dispatch<React.SetStateAction<string>>
  setView: (v: string) => void
}

const BankPicker: React.FC<BankPickerProps> = ({ withdraw, setWithdraw, bankSearch, setBankSearch, setView }) => {
  const bankList = withdraw.country === "MZ" ? BANKS_MZ : BANKS_ZA
  const filteredBanks = bankList.filter((bank) => bank.toLowerCase().includes(bankSearch.toLowerCase()))

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("withdraw_form")}>
          <ArrowLeft size={20} />
        </button>
        <div className="picker-title">Select bank</div>
      </div>

      <div className="content-container-picker">
        <div className="picker-search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="picker-search"
            placeholder="Type to search"
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="bank-list">
          {filteredBanks.map((bank, idx) => (
            <div
              key={idx}
              className="list-item"
              onClick={() => {
                setWithdraw({ ...withdraw, bank })
                setBankSearch("")
                setView("withdraw_form")
              }}
            >
              {bank}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

type WithdrawConfirmProps = {
  lastWithdrawal: {
    amount: string
    bank: string
    accountNumber: string
    country: "ZA" | "MZ"
  } | null
  setView: (v: string) => void
  setLastWithdrawal: React.Dispatch<React.SetStateAction<any>>
}

const WithdrawConfirm: React.FC<WithdrawConfirmProps> = ({ lastWithdrawal, setView, setLastWithdrawal }) => {
  if (!lastWithdrawal) return null

  const fiat = lastWithdrawal.country === "ZA" ? "ZAR" : "MZN"
  const formattedAmt = Number(lastWithdrawal.amount || 0).toFixed(2)

  return (
    <div className="confirm-banner">
      <div className="confirm-banner-content">
        <div className="confirm-banner-headline">Withdrawal request received!</div>

        <div className="confirm-banner-section">
          <div className="confirm-banner-label">Amount</div>
          <div className="confirm-banner-value-amount">
            {formattedAmt} {fiat}
          </div>
        </div>

        <div className="confirm-banner-section">
          <div className="confirm-banner-label">Withdrawn to</div>
          <div className="confirm-banner-value">{lastWithdrawal.bank}</div>
        </div>

        <div className="confirm-banner-section">
          <div className="confirm-banner-label">Account number</div>
          <div className="confirm-banner-value mono">{formatAccountNumberForDisplay(lastWithdrawal.accountNumber)}</div>
        </div>

        <button
          className="confirm-banner-ok"
          onClick={() => {
            setView("home")
            setLastWithdrawal(null)
          }}
        >
          OK
        </button>
      </div>
    </div>
  )
}

type WithdrawFormProps = {
  withdraw: Withdraw
  setWithdraw: React.Dispatch<React.SetStateAction<Withdraw>>
  touchedFields: Set<string>
  setTouchedFields: React.Dispatch<React.SetStateAction<Set<string>>>
  validateWithdrawForm: () => boolean
  isProcessing: boolean
  handleWithdrawSubmit: () => void
  setView: (v: string) => void
}

const WithdrawForm: React.FC<WithdrawFormProps> = ({
  withdraw,
  setWithdraw,
  touchedFields,
  setTouchedFields,
  validateWithdrawForm,
  isProcessing,
  handleWithdrawSubmit,
  setView,
}) => {
  // Use hooks internally; do not rely on props for balance
  const { balances, loading, refresh, error } = useWallet()
  const { user } = useAuthGate()
  const available = Number(balances?.USDT ?? 0)
  const isValid = validateWithdrawForm()

  // Defensive console log on mount
  useEffect(() => {
    console.log('[WITHDRAW_MOUNT]', { available: balances?.USDT })
  }, [balances?.USDT])

  if (loading) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("home")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Withdraw</div>
        </div>
        <div className="content-container-centered">
          <WalletSkeleton />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("home")}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="content-container-centered">
        <div className="card deposit-options-card">
          <div className="deposit-options-title">Withdraw</div>
          <div className="deposit-options-subtitle">
            Available: {available.toFixed(2)} USDT
          </div>
          <div className="form-group">
            <div className="form-label">Bank name</div>
            <div
              className="form-input form-input-clickable"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setView("withdraw_bank_picker")}
            >
              {withdraw.bank || "Select bank name"}
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <div className="form-label">Amount to withdraw</div>
              <button
                className="inline-action"
                onClick={() => {
                  setWithdraw({ ...withdraw, amount: available.toFixed(2) })
                  setTouchedFields(new Set(touchedFields).add("amount"))
                }}
              >
                Use all
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="form-input"
              placeholder="0.00"
              value={withdraw.amount}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".")
                setWithdraw({ ...withdraw, amount: v })
                setTouchedFields(new Set(touchedFields).add("amount"))
              }}
              onBlur={() => setTouchedFields(new Set(touchedFields).add("amount"))}
            />
            {touchedFields.has("amount") && (Number(withdraw.amount) <= 0 || Number(withdraw.amount) > available) && (
              <div className="field-error">
                {Number(withdraw.amount) <= 0 ? "Amount must be greater than 0" : "Amount exceeds available balance"}
              </div>
            )}
          </div>

          <div className="form-group">
            <div className="form-label">Account holder</div>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="form-input"
              placeholder="Full name"
              value={withdraw.holder}
              onChange={(e) => {
                setWithdraw({ ...withdraw, holder: e.target.value })
                setTouchedFields(new Set(touchedFields).add("holder"))
              }}
              onBlur={() => setTouchedFields(new Set(touchedFields).add("holder"))}
            />
            {touchedFields.has("holder") && withdraw.holder.length > 0 && withdraw.holder.length < 2 && (
              <div className="field-error">Name must be at least 2 characters</div>
            )}
          </div>

          <div className="form-group">
            <div className="form-label">Account type</div>
            <select
              className="form-input"
              value={withdraw.accountType}
              onChange={(e) => {
                setWithdraw({ ...withdraw, accountType: e.target.value })
                setTouchedFields(new Set(touchedFields).add("accountType"))
              }}
              onBlur={() => setTouchedFields(new Set(touchedFields).add("accountType"))}
            >
              <option value="">Select account type</option>
              <option value="Current / Cheque">Current / Cheque</option>
              <option value="Savings">Savings</option>
              <option value="Business">Business</option>
            </select>
          </div>

          <div className="form-group">
            <div className="form-label">Branch code</div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="form-input"
              placeholder="3–8 digits"
              value={withdraw.branchCode}
              onChange={(e) => {
                const digits = sanitizeDigits(e.target.value)
                setWithdraw({ ...withdraw, branchCode: digits })
                setTouchedFields(new Set(touchedFields).add("branchCode"))
              }}
              onBlur={() => setTouchedFields(new Set(touchedFields).add("branchCode"))}
            />
            {touchedFields.has("branchCode") &&
              withdraw.branchCode.length > 0 &&
              (withdraw.branchCode.length < 3 || withdraw.branchCode.length > 8) && (
                <div className="field-error">Branch code must be 3–8 digits</div>
              )}
          </div>

          <div className="form-group">
            <div className="form-label">Account number</div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="form-input monospace"
              placeholder="6–16 digits"
              value={withdraw.accountNumberRaw}
              onChange={(e) => {
                const digits = sanitizeDigits(e.target.value)
                setWithdraw({ ...withdraw, accountNumberRaw: digits })
                setTouchedFields(new Set(touchedFields).add("accountNumberRaw"))
              }}
              onBlur={() => setTouchedFields(new Set(touchedFields).add("accountNumberRaw"))}
            />
            {touchedFields.has("accountNumberRaw") &&
              withdraw.accountNumberRaw.length > 0 &&
              (withdraw.accountNumberRaw.length < 6 || withdraw.accountNumberRaw.length > 16) && (
                <div className="field-error">Account number must be 6–16 digits</div>
              )}
          </div>

          <div className="form-group">
            <div className="form-label">Country</div>
            <select
              className="form-input"
              value={withdraw.country}
              onChange={(e) => setWithdraw({ ...withdraw, country: e.target.value })}
            >
              <option value="ZA">South Africa (ZA)</option>
              <option value="MZ">Mozambique (MZ)</option>
            </select>
          </div>

          <button
            className="confirm-btn"
            onClick={handleWithdrawSubmit}
            disabled={!isValid || isProcessing || loading}
            style={{ marginTop: 8 }}
          >
            {isProcessing ? "Processing..." : "Authorize withdrawal"}
          </button>
          {error && (
            <div className="field-error" style={{ marginTop: 8, textAlign: 'center' }}>
              Could not load balance. Please try again.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

type AboutSectionProps = {
  openAccordion: string | null
  setOpenAccordion: React.Dispatch<React.SetStateAction<string | null>>
}

const AboutSection: React.FC<AboutSectionProps> = ({ openAccordion, setOpenAccordion }) => {
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

  return (
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
}

type DepositOptionsProps = {
  setView: (v: string) => void
  setSnackbarMessage: React.Dispatch<React.SetStateAction<string>>
  setShowSnackbar: React.Dispatch<React.SetStateAction<boolean>>
}

const DepositOptions: React.FC<DepositOptionsProps> = ({ setView, setSnackbarMessage, setShowSnackbar }) => {
  const { balances, refresh, loading } = useWallet()

  // Refresh on mount and when screen becomes visible
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  if (loading) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("home")}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="content-container-centered">
          <WalletSkeleton />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("home")}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="content-container-centered">
        <div className="card deposit-options-card">
          <div className="deposit-options-title">Deposit {DEPOSIT_INFO.currency}</div>
          <div className="deposit-options-subtitle">
            {balances.USDT.toFixed(2)} {DEPOSIT_INFO.currency} available
          </div>

          <div className="deposit-options-buttons">
            <button className="option-btn" onClick={() => setView("deposit_eft")}>
              <div className="option-btn-content">
                <Landmark size={20} />
                <span>Deposit via EFT</span>
              </div>
            </button>

            <button
              className="option-btn"
              onClick={() => setView("deposit_card")}
            >
              <div className="option-btn-content">
                <CreditCard size={20} />
                <span>Pay with Card</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

type EFTDetailsProps = {
  setView: (v: string) => void
  handleCopy: (text: string) => void
}

const EFTDetails: React.FC<EFTDetailsProps> = ({ setView, handleCopy }) => (
  <>
    <div className="header-area">
      <button className="back-button-header" onClick={() => setView("deposit_options")}>
        <ArrowLeft size={20} />
      </button>
    </div>

    <div className="content-container-centered">
      <div className="card eft-details-card">
        <div className="eft-title">Sign in to your bank and make a deposit with the following information:</div>

        <div className="pill-ref" onClick={() => handleCopy(DEPOSIT_INFO.referenceCode)}>
          <div className="pill-ref-label">Make a deposit using the reference</div>
          <div className="pill-ref-code">{DEPOSIT_INFO.referenceCode}</div>
        </div>

        <div style={{ height: 16 }} />

        <div className="kv-list">
          <div className="kv-row">
            <div className="kv-label">Recipient</div>
            <div className="kv-value">{DEPOSIT_INFO.bank.recipient}</div>
          </div>
          <div className="kv-row">
            <div className="kv-label">Account number</div>
            <div className="kv-value mono">{formatAccountNumber(DEPOSIT_INFO.bank.accountNumber)}</div>
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
            <div className="kv-value mono">{DEPOSIT_INFO.bank.branch}</div>
          </div>
          <div className="kv-row">
            <div className="kv-label">Reference number</div>
            <div className="kv-value kv-value-copy mono">
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

type WithdrawFlowProps = {
  withdrawAmount: string
  setWithdrawAmount: React.Dispatch<React.SetStateAction<string>>
  exceedsMax: boolean
  setExceedsMax: React.Dispatch<React.SetStateAction<boolean>>
  showCopyTooltip: boolean
  isProcessing: boolean
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
  setShowSnackbar: React.Dispatch<React.SetStateAction<boolean>>
  setSnackbarMessage: React.Dispatch<React.SetStateAction<string>>
  setShowWithdrawFlow: React.Dispatch<React.SetStateAction<boolean>>
  handleCopy: (text: string) => void
}

const WithdrawFlow: React.FC<WithdrawFlowProps> = ({
  withdrawAmount,
  setWithdrawAmount,
  exceedsMax,
  setExceedsMax,
  showCopyTooltip,
  isProcessing,
  setIsProcessing,
  setShowSnackbar,
  setSnackbarMessage,
  setShowWithdrawFlow,
  handleCopy,
}) => {
  // Use hooks internally; do not rely on props for balance
  const { balances, refresh } = useWallet()
  const available = Number(balances?.USDT ?? 0)

  // Defensive console log on mount
  useEffect(() => {
    console.log('[WITHDRAW_FLOW_MOUNT]', { available: balances?.USDT })
  }, [balances?.USDT])

  return (
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
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="amount-input"
                value={withdrawAmount}
                onChange={(e) => {
                  const newAmount = e.target.value
                  setWithdrawAmount(newAmount)
                  setExceedsMax(Number.parseFloat(newAmount) > available)
                }}
                placeholder="0"
              />
            </div>
            <div className="max-container">
              <div className={`max-value ${exceedsMax ? "max-value-exceeded" : ""}`}>{available.toFixed(2)}</div>
              <button className="max-button" onClick={() => {
                setWithdrawAmount(available.toString())
              }}>
                Max
              </button>
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">My wallet address</div>
            <div className="address-container">
              <div className="address-display address-display-simplified">
                <span className="address-text">0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb</span>
                <Copy
                  className="copy-icon"
                  size={14}
                  onClick={() => handleCopy("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")}
                />
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
        onClick={async () => {
          const amt = Number.parseFloat(withdrawAmount)
          console.log('[WITHDRAW_FLOW_CONFIRM]', { amt, available })
          
          setIsProcessing(true)
          setShowSnackbar(true)
          setSnackbarMessage("Withdrawal successful!")
          
          setTimeout(async () => {
            try {
              // Refresh wallet to get latest balance
              await refresh()
              console.log('[WITHDRAW_FLOW_CONFIRM]', 'Success - refreshed wallet')
              setShowSnackbar(false)
              setShowWithdrawFlow(false)
              setWithdrawAmount("")
              setIsProcessing(false)
            } catch (e: any) {
              console.error('[WITHDRAW_FLOW_CONFIRM_ERROR]', e)
              setIsProcessing(false)
            }
          }, 2000)
        }}
        disabled={
          !withdrawAmount ||
          Number.parseFloat(withdrawAmount) <= 0 ||
          Number.parseFloat(withdrawAmount) > available ||
          isProcessing
        }
      >
        <span>{isProcessing ? "Processing withdrawal..." : "Confirm withdrawal"}</span>
        {!isProcessing && <span>→</span>}
      </button>
    </div>
    </>
  )
}

type WalletUnconnectedProps = {
  balance: number
  setView: (v: string) => void
  openAccordion: string | null
  setOpenAccordion: React.Dispatch<React.SetStateAction<string | null>>
  requireAuth: (next: () => void) => void
}

const WalletUnconnected: React.FC<WalletUnconnectedProps> = ({ balance, setView, openAccordion, setOpenAccordion, requireAuth }) => {
  // Use useWallet for canonical balance (prefer USDT for display)
  const { balances, handle } = useWallet()
  const displayBalance = balances.USDT ?? balance ?? 0
  
  return (
    <div className="content-container">
      <div className="card">
        <div className="wallet-header-centered">
          <AvatarUploader />
          {handle && (
            <div className="wallet-handle">@{handle}</div>
          )}
        </div>
        <div className="unconnected-balance-container">
          {displayBalance === null || displayBalance === undefined || displayBalance === 0 ? (
            <>
              <div className="unconnected-balance-amount">—</div>
              <div className="unconnected-balance-secondary">—</div>
            </>
          ) : (
            <>
              <div className="unconnected-balance-amount">{displayBalance.toFixed(2)} USD</div>
              <div className="unconnected-balance-secondary">{(displayBalance * 75.548).toFixed(2)} MTn</div>
            </>
          )}
        </div>
      <div className="unconnected-action-buttons">
        <button className="btn btn-icon btn-primary" onClick={() => requireAuth(() => setView("deposit_options"))}>
          <span>Deposit</span>
          <ArrowDownToLine size={16} />
        </button>
        <button className="btn btn-icon btn-secondary" onClick={() => requireAuth(() => setView("send_methods"))}>
          <span>Send</span>
          <Send size={16} />
        </button>
        <button className="btn btn-icon btn-secondary" onClick={() => requireAuth(() => setView("withdraw_form"))}>
          <span>Withdraw</span>
          <ArrowUpFromLine size={16} />
        </button>
      </div>
    </div>
    <AboutSection openAccordion={openAccordion} setOpenAccordion={setOpenAccordion} />
  </div>
  )
}

// Send Methods Landing Page
type SendMethodsProps = {
  setView: (v: string) => void
}

const SendMethods: React.FC<SendMethodsProps> = ({ setView }) => {
  // Use hooks internally; do not rely on props for user/balance
  const { balances, loading } = useWallet()
  
  // Acceptance test checkpoint
  console.debug('[ACCEPTANCE] balances snapshot', balances)

  if (loading) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("home")}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="content-container-centered">
          <WalletSkeleton />
        </div>
      </>
    )
  }

  return (
    <ErrorBoundary>
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("home")}>
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="content-container-centered">
          <div className="card deposit-options-card">
            <div className="deposit-options-title">Send USDT</div>
            <div className="deposit-options-subtitle">
              Available: {balances.USDT.toFixed(2)} USDT
            </div>

            <div className="deposit-options-buttons">
              <button className="option-btn" onClick={() => setView("send_email_phone")}>
                <div className="option-btn-content">
                  <Mail size={20} />
                  <span>Send to Email or Phone</span>
                </div>
                <ChevronRight size={20} style={{ opacity: 0.6 }} />
              </button>

              <button className="option-btn" onClick={() => setView("send_address")}>
                <div className="option-btn-content">
                  <Wallet size={20} />
                  <span>Send to USDT Wallet</span>
                </div>
                <ChevronRight size={20} style={{ opacity: 0.6 }} />
              </button>

              <button className="option-btn" onClick={() => setView("send_to_brics")}>
                <div className="option-btn-content">
                  <User size={20} />
                  <span>Send to BRICS Account</span>
                </div>
                <ChevronRight size={20} style={{ opacity: 0.6 }} />
              </button>
            </div>
          </div>
        </div>
      </>
    </ErrorBoundary>
  )
}

// Send Email/Phone Component
type SendEmailPhoneProps = {
  setView: (v: string) => void
}

const SendEmailPhone: React.FC<SendEmailPhoneProps> = ({ setView }) => {
  // Use hooks internally; do not rely on props for user/balance
  const { balances, loading, refresh } = useWallet()
  const { user } = useAuthGate()
  const [type, setType] = useState<'email' | 'phone'>('email')
  const [value, setValue] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Acceptance test checkpoint
  console.debug('[ACCEPTANCE] balances snapshot', balances)

  const formAmount = Number(amount) || 0
  const isValid = value.length > 0 && formAmount > 0 && !isNaN(formAmount) && formAmount <= balances.USDT
  
  // Guard against invalid USDT value
  if (!isFinite(balances.USDT) || balances.USDT < 0) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("send_methods")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Send to Email or Phone</div>
        </div>
        <div className="content-container-centered">
          <WalletSkeleton />
        </div>
      </>
    )
  }

  const submit = async () => {
    if (!user) {
      setError('Not signed in')
      return
    }

    if (formAmount > balances.USDT) {
      setError('Insufficient balance')
      return
    }

    setSubmitting(true)
    setError(null)

    // Diagnostic log before submit
    console.log('CLIENT_SEND', {
      usdt: balances.USDT,
      amount: formAmount,
      toType: type,
    })

    try {
      const idToken = await user.getIdToken()
      if (!idToken) throw new Error('Not signed in')

      const r = await fetch('/api/internal/send/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          to: { type, value },
          amountUSDT: formAmount,
          memo: memo || undefined,
        }),
      })

      const json = await r.json()

      if (!json.ok) {
        setError(json.error || 'init_failed')
        return
      }

      setResult(json)
      // Revalidate wallet data to reflect new balance
      await refresh()
    } catch (e: any) {
      setError(e.message || 'init_failed')
    } finally {
      setSubmitting(false)
    }
  }

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
              {result.mode === 'settled' ? (
                <>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                    Sent {formAmount.toFixed(2)} USDT to {value}
                  </h2>
                  <p style={{ color: '#666', marginBottom: '24px' }}>
                    Transfer completed to an existing BRICS user.
                  </p>
                  <button className="btn btn-primary" onClick={() => setView("home")} style={{ width: '100%' }}>
                    Back to Wallet
                  </button>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Invite created</h2>
                  <p style={{ color: '#666', marginBottom: '16px' }}>
                    Share this link so the recipient can claim:
                  </p>
                  <div
                    style={{
                      background: '#f5f5f5',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px',
                      wordBreak: 'break-all',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {result.claimUrl}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.claimUrl)
                        setError('Link copied!')
                        setTimeout(() => setError(null), 2000)
                      } catch (e) {
                        setError('Failed to copy')
                        setTimeout(() => setError(null), 2000)
                      }
                    }}
                    style={{ width: '100%', marginBottom: '12px' }}
                  >
                    Copy link
                  </button>
                  <button className="btn btn-secondary" onClick={() => setView("home")} style={{ width: '100%' }}>
                    Back to Wallet
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("send_methods")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Send to Email or Phone</div>
        </div>
        <div className="content-container-centered">
          <WalletSkeleton />
        </div>
      </>
    )
  }

  return (
    <ErrorBoundary>
      <>
        <div className="header-area">
          <button className="back-button-header" onClick={() => setView("send_methods")}>
            <ArrowLeft size={20} />
          </button>
          <div className="picker-title">Send to Email or Phone</div>
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
                <div className="form-label">Type</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn ${type === 'email' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setType('email')}
                  >
                    Email
                  </button>
                  <button
                    className={`btn ${type === 'phone' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setType('phone')}
                  >
                    Phone
                  </button>
                </div>
              </div>

              <div className="form-group">
                <div className="form-label">{type === 'email' ? 'Email' : 'Phone'}</div>
                <input
                  className="form-input"
                  type={type === 'email' ? 'email' : 'tel'}
                  inputMode={type === 'phone' ? 'tel' : 'email'}
                  autoComplete={type === 'email' ? 'email' : 'tel'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={type === 'email' ? 'name@example.com' : '+27... (E.164)'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="form-label">Amount (USDT)</div>
                <input
                  className="form-input"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
  )
}

// Claim Component
type ClaimProps = {
  code: string
  setView: (v: string) => void
}

const Claim: React.FC<ClaimProps> = ({ code, setView }) => {
  // Use hooks internally; do not rely on props for user/balance
  const { user } = useAuthGate()
  const { refresh } = useWallet()
  const [msg, setMsg] = useState('Processing…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setError('missing_code')
      setMsg('Invalid claim link')
      return
    }

    (async () => {
      if (!user) {
        setMsg('Please sign in first')
        setError('not_authenticated')
        // Could redirect to auth here, but for now just show message
        return
      }

      try {
        const idToken = await user.getIdToken()
        const r = await fetch(`/api/internal/send/claim?code=${encodeURIComponent(code)}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` },
        })

        const j = await r.json()

        if (j.ok) {
          setMsg('Funds claimed successfully!')
          // Refresh wallet to get latest balance
          await refresh()
          setTimeout(() => setView('home'), 2000)
        } else {
          setError(j.error || 'claim_failed')
          setMsg(`Error: ${j.error}`)
        }
      } catch (e: any) {
        setError(e.message || 'claim_failed')
        setMsg(`Error: ${e.message}`)
      }
    })()
  }, [code, user, setView, refresh])

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("home")}>
          <ArrowLeft size={20} />
        </button>
        <div className="picker-title">Claim Funds</div>
      </div>

      <div className="content-container-centered">
        <div className="centered-col">
          <div className="card">
            <div style={{ textAlign: 'center', padding: '24px' }}>
              {error ? (
                <>
                  <p style={{ color: '#C74242', marginBottom: '16px' }}>{msg}</p>
                  <button className="btn btn-primary" onClick={() => setView("home")}>
                    Back to Wallet
                  </button>
                </>
              ) : (
                <p style={{ color: '#666' }}>{msg}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Added Send flow components
type SendAddressProps = {
  send: SendFlow
  setSend: React.Dispatch<React.SetStateAction<SendFlow>>
  setView: (v: string) => void
  balance: number
  showBottomSheet: string | null
  setShowBottomSheet: React.Dispatch<React.SetStateAction<string | null>>
}

const SendAddress: React.FC<SendAddressProps> = ({
  send,
  setSend,
  setView,
  balance,
  showBottomSheet,
  setShowBottomSheet,
}) => {
  const isValid = send.address.length > 10 && send.network !== ""

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("home")}>
          <ArrowLeft size={20} />
        </button>
        <div className="picker-title">Send USDT</div>
      </div>

      <div className="content-container-centered">
        <div className="page-subline">Available: {balance !== null && balance !== undefined ? balance.toFixed(2) : '—'} USDT</div>

        <div className="centered-col">
          <div className="card">
            <div className="form-group">
              <div className="form-label">USDT wallet address</div>
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="form-input"
                value={send.address}
                onChange={(e) => setSend({ ...send, address: e.target.value })}
                placeholder="Enter wallet address"
              />
            </div>

            <div className="form-group">
              <div className="form-label">Network</div>
              <div className="form-input form-input-clickable" onClick={() => setShowBottomSheet("network")}>
                {send.network ? send.network.toUpperCase() : "Select network"}
                <ChevronDown size={16} />
              </div>
            </div>

            {send.network && (
              <div
                style={{
                  background: "#FFF9E6",
                  border: "1px solid #FFE58F",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "13px",
                  color: "#666",
                  marginTop: "16px",
                }}
              >
                Please ensure the address is supported on {send.network.toUpperCase()}. If it isn't, you may lose your
                funds.
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ marginTop: "24px", width: "100%" }}
              disabled={!isValid}
              onClick={() => setView("send_amount")}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>

      {showBottomSheet === "network" && (
        <div className="bottom-sheet-overlay" onClick={() => setShowBottomSheet(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-title">Select Network</div>
            <div className="bottom-sheet-list">
              {["tron", "ethereum", "solana"].map((net) => (
                <div
                  key={net}
                  className="bottom-sheet-item"
                  onClick={() => {
                    setSend({ ...send, network: net as any })
                    setShowBottomSheet(null)
                  }}
                >
                  <span>
                    {net === "tron" ? "TRON (TRC20)" : net === "ethereum" ? "Ethereum (ERC20)" : "Solana (SPL)"}
                  </span>
                  {send.network === net && <span style={{ color: "#1E5BFF" }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

type SendAmountProps = {
  send: SendFlow
  setSend: React.Dispatch<React.SetStateAction<SendFlow>>
  setView: (v: string) => void
  balance: number
}

const SendAmount: React.FC<SendAmountProps> = ({ send, setSend, setView, balance }) => {
  const min = 0.99
  const fee = 1.0
  const dailyUsed = 500
  const dailyCap = 10000
  const maxAmount = balance - fee

  const amount = Number(send.amount) || 0
  const isValid = amount >= min && amount <= maxAmount

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("send_address")}>
          <ArrowLeft size={20} />
        </button>
        <div className="picker-title">Send USDT</div>
      </div>

      <div className="content-container-centered">
        <div className="page-subline">Available: {balance !== null && balance !== undefined ? balance.toFixed(2) : '—'} USDT</div>

        <div className="centered-col">
          <div className="card">
            <div className="form-group">
              <div className="form-label">Amount</div>

              <div className="input-field">
                <div className="currency-badge">
                  <div className="currency-icon">
                    <Banknote size={16} />
                  </div>
                  <div className="currency-label">USDT</div>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  className="amount-input"
                  value={send.amount}
                  onChange={(e) => setSend({ ...send, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="max-container">
                <div className="max-value">{(balance - fee).toFixed(2)}</div>
                <button className="max-button" onClick={() => setSend({ ...send, amount: maxAmount.toFixed(2) })}>
                  USE ALL
                </button>
              </div>
            </div>

            {/* Min/Fee row */}
            <div
              style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginTop: 8 }}
            >
              <span>
                Min {min} USDT&nbsp;&nbsp;Fee {fee.toFixed(2)} USDT
              </span>
            </div>

            {/* Daily limit meter */}
            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  color: "#666",
                  marginBottom: "8px",
                }}
              >
                <span>Daily limit USDT 500,000,000</span>
              </div>
              <div style={{ height: "6px", background: "#E5E5E5", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(dailyUsed / dailyCap) * 100}%`, background: "#0E75B7" }} />
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: "24px", width: "100%" }}
              disabled={!isValid}
              onClick={() => setView("send_recipient")}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

type SendRecipientProps = {
  send: SendFlow
  setSend: React.Dispatch<React.SetStateAction<SendFlow>>
  setView: (v: string) => void
  balance: number // add balance prop
  showBottomSheet: string | null
  setShowBottomSheet: React.Dispatch<React.SetStateAction<string | null>>
  providerSearch: string
  setProviderSearch: React.Dispatch<React.SetStateAction<string>>
}

const SendRecipient: React.FC<SendRecipientProps> = ({
  send,
  setSend,
  setView,
  balance, // destructure balance
  showBottomSheet,
  setShowBottomSheet,
  providerSearch,
  setProviderSearch,
}) => {
  const isValid =
    send.recipientType !== "" &&
    send.recipientName.length > 0 &&
    send.walletType !== "" &&
    (send.walletType === "self_hosted" || send.provider !== "")

  const filteredProviders = CRYPTO_PROVIDERS.filter((p) => p.toLowerCase().includes(providerSearch.toLowerCase()))

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("send_amount")}>
          <ArrowLeft size={20} />
        </button>
        <div className="picker-title">Send USDT</div>
      </div>

      <div className="content-container-centered">
        <div className="page-subline">Available: {balance !== null && balance !== undefined ? balance.toFixed(2) : '—'} USDT</div>

        <div className="centered-col">
          <div className="card">
            <div className="form-group">
              <div className="form-label">Recipient type</div>
              <div className="form-input form-input-clickable" onClick={() => setShowBottomSheet("recipientType")}>
                {send.recipientType
                  ? send.recipientType === "individual"
                    ? "Individual"
                    : "Corporate"
                  : "Select type"}
                <ChevronDown size={16} />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label">Recipient</div>
              <input
                type="text"
                className="form-input"
                value={send.recipientName}
                onChange={(e) => setSend({ ...send, recipientName: e.target.value })}
                placeholder="Full name or entity name"
              />
            </div>

            <div className="form-group">
              <div className="form-label">Wallet</div>
              <div className="form-input form-input-clickable" onClick={() => setShowBottomSheet("walletType")}>
                {send.walletType
                  ? send.walletType === "csp"
                    ? "Crypto service provider"
                    : "Self-hosted wallet"
                  : "Select wallet type"}
                <ChevronDown size={16} />
              </div>
            </div>

            {send.walletType === "csp" && (
              <div className="form-group">
                <div className="form-label">Service provider</div>
                <div className="form-input form-input-clickable" onClick={() => setShowBottomSheet("provider")}>
                  {send.provider || "Select provider"}
                  <ChevronDown size={16} />
                </div>
              </div>
            )}

            <div style={{ fontSize: "12px", color: "#999", marginTop: "16px", lineHeight: "1.5" }}>
              To comply with local and global regulations, crypto service providers now need to collect this
              information. Learn more
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: "24px", width: "100%" }}
              disabled={!isValid}
              onClick={() => setView("send_review")}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>

      {showBottomSheet === "recipientType" && (
        <div className="bottom-sheet-overlay" onClick={() => setShowBottomSheet(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-title">Recipient Type</div>
            <div className="bottom-sheet-list">
              {["individual", "corporate"].map((type) => (
                <div
                  key={type}
                  className="bottom-sheet-item"
                  onClick={() => {
                    setSend({ ...send, recipientType: type as any })
                    setShowBottomSheet(null)
                  }}
                >
                  <span>{type === "individual" ? "Individual" : "Corporate"}</span>
                  {send.recipientType === type && <span style={{ color: "#1E5BFF" }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBottomSheet === "walletType" && (
        <div className="bottom-sheet-overlay" onClick={() => setShowBottomSheet(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-title">Wallet Type</div>
            <div className="bottom-sheet-list">
              {[
                { value: "csp", label: "Crypto service provider" },
                { value: "self_hosted", label: "Self-hosted wallet" },
              ].map((type) => (
                <div
                  key={type.value}
                  className="bottom-sheet-item"
                  onClick={() => {
                    setSend({
                      ...send,
                      walletType: type.value as any,
                      provider: type.value === "self_hosted" ? "" : send.provider,
                    })
                    setShowBottomSheet(null)
                  }}
                >
                  <span>{type.label}</span>
                  {send.walletType === type.value && <span style={{ color: "#1E5BFF" }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBottomSheet === "provider" && (
        <div className="bottom-sheet-overlay" onClick={() => setShowBottomSheet(null)}>
          <div className="bottom-sheet-full" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-header">
              <button
                onClick={() => setShowBottomSheet(null)}
                style={{ background: "none", border: "none", padding: "8px" }}
              >
                <ArrowLeft size={20} />
              </button>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>Service Provider</div>
              <div style={{ width: "36px" }} />
            </div>
            <div style={{ padding: "16px" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search providers..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="bottom-sheet-list" style={{ maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
              {filteredProviders.map((provider) => (
                <div
                  key={provider}
                  className="bottom-sheet-item"
                  onClick={() => {
                    setSend({ ...send, provider })
                    setShowBottomSheet(null)
                    setProviderSearch("")
                  }}
                >
                  <span>{provider}</span>
                  {send.provider === provider && <span style={{ color: "#1E5BFF" }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

type SendReviewProps = {
  send: SendFlow
  setView: (v: string) => void
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
  setSnackbarMessage: React.Dispatch<React.SetStateAction<string>>
  setShowSnackbar: React.Dispatch<React.SetStateAction<boolean>>
}

const SendReview: React.FC<SendReviewProps> = ({
  send,
  setView,
  balance,
  setBalance,
  setSnackbarMessage,
  setShowSnackbar,
}) => {
  const fee = 1.0
  const amount = Number(send.amount)
  const total = amount + fee

  const handleConfirm = () => {
    setBalance(balance - total)
    setView("send_success")
  }

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("send_recipient")}>
          <ArrowLeft size={20} />
        </button>
        <div className="picker-title">Review</div>
      </div>

      <div className="content-container-centered">
        <div className="page-subline">Available: {balance !== null && balance !== undefined ? balance.toFixed(2) : '—'} USDT</div>

        <div className="centered-col">
          <div className="card">
            <div className="kv-list notop">
              <div className="kv-row">
                <div className="kv-label">Tether address</div>
                <div className="kv-value address" style={{ fontSize: "12px" }}>
                  {send.address}
                </div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Network</div>
                <div className="kv-value">{send.network.toUpperCase()}</div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Amount</div>
                <div className="kv-value">{amount.toFixed(2)} USDT</div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Transaction fee</div>
                <div className="kv-value">{fee.toFixed(2)} USDT</div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Total</div>
                <div className="kv-value" style={{ fontWeight: 600 }}>
                  {total.toFixed(2)} USDT
                </div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Recipient type</div>
                <div className="kv-value">{send.recipientType === "individual" ? "Individual" : "Corporate"}</div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Recipient</div>
                <div className="kv-value">{send.recipientName}</div>
              </div>
              <div className="kv-row">
                <div className="kv-label">Wallet</div>
                <div className="kv-value">{send.walletType === "csp" ? "Crypto service provider" : "Self-hosted"}</div>
              </div>
              {send.walletType === "csp" && (
                <div className="kv-row">
                  <div className="kv-label">Service provider</div>
                  <div className="kv-value">{send.provider}</div>
                </div>
              )}
            </div>

            <button className="btn btn-primary" style={{ marginTop: "24px", width: "100%" }} onClick={handleConfirm}>
              CONFIRM SEND
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

type SendSuccessProps = {
  send: SendFlow
  setView: (v: string) => void
  setSend: React.Dispatch<React.SetStateAction<SendFlow>>
}

const SendSuccess: React.FC<SendSuccessProps> = ({ send, setView, setSend }) => {
  const handleOK = () => {
    // Reset send flow
    setSend({
      address: "",
      network: "",
      amount: "",
      recipientType: "",
      recipientName: "",
      walletType: "",
      provider: "",
    })
    setView("home")
  }

  return (
    <div className="confirm-banner">
      <div className="confirm-banner-content">
        <div className="confirm-banner-heading">Send request received!</div>
        <div className="confirm-banner-amount">{Number(send.amount).toFixed(2)} USDT</div>

        <div className="confirm-banner-detail">
          <div className="confirm-banner-label">Sent to</div>
          <div className="confirm-banner-value mono">{send.address}</div>
        </div>

        <div className="confirm-banner-detail">
          <div className="confirm-banner-label">Network</div>
          <div className="confirm-banner-value">{send.network.toUpperCase()}</div>
        </div>

        <button className="confirm-banner-ok" onClick={handleOK}>
          OK
        </button>
      </div>
    </div>
  )
}

type DepositCardProps = {
  userId: string
  setView: (v: string) => void
  setSnackbarMessage: React.Dispatch<React.SetStateAction<string>>
  setShowSnackbar: React.Dispatch<React.SetStateAction<boolean>>
}

const DepositCard: React.FC<DepositCardProps> = ({ userId, setView, setSnackbarMessage, setShowSnackbar }) => {
  const [amount, setAmount] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePay = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setSnackbarMessage("Please enter a valid amount")
      setShowSnackbar(true)
      setTimeout(() => setShowSnackbar(false), 2000)
      return
    }

    setIsProcessing(true)
    try {
      const r = await fetch('/api/payfast/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, user_id: userId }),
        credentials: 'include'
      })
      
      if (!r.ok) {
        // Try to read JSON error, fallback to status text
        let errorMsg = "Payment failed. Please try again."
        try {
          const errorData = await r.json()
          errorMsg = errorData.detail || errorData.error || errorMsg
        } catch (parseErr) {
          // If JSON parse fails (e.g., HTML error page), use generic message
          errorMsg = "Server error. Please try again later."
        }
        throw new Error(errorMsg)
      }
      
      const data = await r.json()
      if (data.redirect_url) {
        // Store ref in localStorage before redirecting
        if (data.ref) {
          localStorage.setItem('lastPayRef', data.ref)
        }
        window.location.href = data.redirect_url
      } else {
        throw new Error(data.error || data.detail || 'Failed to create payment')
      }
    } catch (e: any) {
      setIsProcessing(false)
      setSnackbarMessage(e.message || "Payment failed. Please try again.")
      setShowSnackbar(true)
      setTimeout(() => setShowSnackbar(false), 3000)
    }
  }

  return (
    <>
      <div className="header-area">
        <button className="back-button-header" onClick={() => setView("deposit_options")}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="content-container-form">
        <div className="form-header">
          <div className="form-title">Pay with Card</div>
        </div>

        <div className="form-container">
          <div className="form-card">
            <div className="form-group">
              <label className="form-label">Amount (USDT)</label>
              <div className="input-field">
                <input
                  type="number"
                  className="amount-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  disabled={isProcessing}
                />
                <div className="currency-badge">
                  <div className="currency-icon">$</div>
                  <div className="currency-label">USDT</div>
                </div>
              </div>
            </div>

            <button
              className="confirm-btn"
              onClick={handlePay}
              disabled={!amount || Number(amount) <= 0 || isProcessing}
            >
              {isProcessing ? "Processing..." : "Continue to Payment"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

type DepositSuccessProps = {
  setView: (v: string) => void
  setBalance: React.Dispatch<React.SetStateAction<number>>
  balance: number
  userId: string
}

const DepositSuccess: React.FC<DepositSuccessProps> = ({ setView, setBalance, balance, userId }) => {
  const [status, setStatus] = useState<'PENDING' | 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'TIMEOUT'>('PENDING');
  const [amount, setAmount] = useState<string>('');
  const appliedRef = useRef(false);
  const creditAttemptedRef = useRef(false);
  const { refresh } = useWallet()

  useEffect(() => {
    // Extract ref from URL
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (!ref) {
      setStatus('TIMEOUT');
      return;
    }

    // Auto-credit on mount (idempotent)
    if (!creditAttemptedRef.current && userId) {
      creditAttemptedRef.current = true;
      fetch(`/api/payfast/credit?ref=${encodeURIComponent(ref)}`, { cache: 'no-store' })
        .then(async (r) => {
          const data = await r.json();
          if (r.ok && data.ok) {
            if (data.alreadyCredited) {
              console.log('[deposit:success] Already credited', data);
              setStatus('COMPLETE');
              setAmount(String(data.balance));
              // Refresh wallet to get latest balance
              await refresh();
              // Update local balance state for backwards compat
              if (data.balance !== undefined) {
                setBalance(data.balance);
              }
              // Navigate to wallet after brief delay
              setTimeout(() => {
                setView('home');
              }, 1500);
            } else {
              console.log('[deposit:success] Credited successfully', data);
              setStatus('COMPLETE');
              setAmount(String(data.balance));
              // Refresh wallet to get latest balance
              await refresh();
              // Update local balance state for backwards compat
              if (data.balance !== undefined) {
                setBalance(data.balance);
              }
              // Navigate to wallet after brief delay
              setTimeout(() => {
                setView('home');
              }, 1500);
            }
          } else {
            // Credit failed, fall back to polling
            console.warn('[deposit:success] Credit failed, falling back to polling', data);
          }
        })
        .catch((e) => {
          console.error('[deposit:success] Credit error, falling back to polling', e);
          // Fall through to polling
        });
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
        const r = await fetch(`/api/payfast/status?ref=${encodeURIComponent(ref)}`);
        const data = await r.json();

        if (data.status === 'COMPLETE') {
          setStatus('COMPLETE');
          setAmount(data.amount || '');
          // Refresh wallet to get latest balance after deposit completes
          await refresh();
          if (data.balance !== undefined) {
            setBalance(data.balance);
          }
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
  }, [userId, refresh, setBalance, setView]);

  // Balance is now updated via /api/payfast/credit endpoint (Redis-based)
  // Old localStorage increment logic removed - credit endpoint handles it

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
  )
}

type DepositCancelProps = {
  setView: (v: string) => void
}

type BalancePageProps = {
  setView: (v: string) => void
  setBalance: React.Dispatch<React.SetStateAction<number>>
  balance: number
  userId: string
  requireAuth: (next: () => void) => void
  openAccordion: string | null
  setOpenAccordion: React.Dispatch<React.SetStateAction<string | null>>
}

const BalancePage: React.FC<BalancePageProps> = ({ setView, setBalance, balance, userId, requireAuth, openAccordion, setOpenAccordion }) => {
  const [isVerifying, setIsVerifying] = useState(false)
  const { balances, refresh } = useWallet()

  // fetchBalance returns a number (doesn't set state internally)
  // Use canonical /api/me endpoint (via useWallet hook)
  const fetchBalance = useCallback(async (): Promise<number> => {
    if (!userId) return 0
    try {
      await refresh() // Trigger refresh to get latest
      // Return current balance from hook
      return balances.USDT
    } catch (e) {
      console.error('[balance] Failed to fetch balance', e)
    }
    return 0
  }, [userId, balances.USDT, refresh])

  // Single effect: sequential credit + verified fetch
  useEffect(() => {
    let mounted = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      const canceled = params.get('canceled');

      // If canceled, just fetch balance once
      if (canceled === '1') {
        const b = await fetchBalance();
        if (mounted) setBalance(b);
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('canceled');
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url.toString());
        return;
      }

      // No ref: just fetch once
      if (!ref) {
        const b = await fetchBalance();
        if (mounted) setBalance(b);
        return;
      }

      // Has ref: run credit flow
      setIsVerifying(true);

      try {
        // 1) Credit sequentially
        const r = await fetch(`/api/payfast/credit?ref=${encodeURIComponent(ref)}`, { 
          method: 'POST',
          credentials: 'include'
        });
        const data = await r.json();
        console.log('[credit:response]', data);

        // 2) Use credit response as immediate truth to avoid zero flash
        if (data?.ok && typeof data.newBalance === 'number') {
          if (mounted) setBalance(data.newBalance);
        }

        // 3) Verify with a delayed fetch to let Firestore settle
        await new Promise(res => setTimeout(res, 900));

        const verified = await fetchBalance(); // returns number from Firestore
        if (mounted && typeof verified === 'number') {
          setBalance(verified);
        }
      } catch (e) {
        console.warn('[balance] credit flow error', e);
        // Fall back to fetching
        const b = await fetchBalance();
        if (mounted) setBalance(b);
      } finally {
        // 4) Strip ?ref from URL to keep page clean/idempotent
        const url = new URL(window.location.href);
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url.toString());

        if (mounted) setIsVerifying(false);
      }
    })();

    return () => { mounted = false };
  }, [fetchBalance, setBalance])

  return (
    <div className="content-container">
      <div className="card">
        <div className="avatar-container">
          <AvatarUploader userId={userId} />
        </div>
        <div className="unconnected-balance-container">
          {isVerifying ? (
            <>
              <div className="unconnected-balance-amount" style={{ fontSize: '18px', marginBottom: '8px' }}>
                Applying your deposit…
              </div>
              <div style={{ fontSize: '14px', color: '#999' }}>This may take a few seconds</div>
            </>
          ) : balance === null || balance === undefined ? (
            <>
              <div className="unconnected-balance-amount">—</div>
              <div className="unconnected-balance-secondary">—</div>
            </>
          ) : (
            <>
              <div className="unconnected-balance-amount">{balances.USDT.toFixed(2)} USD</div>
              <div className="unconnected-balance-secondary">{(balances.USDT * 75.548).toFixed(2)} MTn</div>
            </>
          )}
        </div>
        <div className="unconnected-action-buttons">
          <button className="btn btn-icon btn-primary" onClick={() => setView("deposit_options")}>
            <span>Deposit</span>
            <ArrowDownToLine size={16} />
          </button>
          <button className="btn btn-icon btn-secondary" onClick={() => requireAuth(() => setView("send_methods"))}>
            <span>Send</span>
            <Send size={16} />
          </button>
          <button className="btn btn-icon btn-secondary" onClick={() => requireAuth(() => setView("withdraw_form"))}>
            <span>Withdraw</span>
            <ArrowUpFromLine size={16} />
          </button>
        </div>
      </div>
      <AboutSection openAccordion={openAccordion} setOpenAccordion={setOpenAccordion} />
    </div>
  )
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
  )
}

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/__debug") {
    return <DebugEnv />;
  }
  if (typeof window !== "undefined" && window.location.pathname === "/auth/google") {
    return <GoogleHandoff />;
  }
  const [userId, setUserId] = useState<string>("")
  const [balance, setBalance] = useState<number | null>(null)
  
  // Embed mode integration
  const { embed, uid, email, sig } = getEmbedParams()
  const isEmbed = embed
  
  // Authentication
  const { isAuthed, user } = useAuthGate()
  const [showAuth, setShowAuth] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  // 'home' | 'deposit_options' | 'deposit_eft' | 'deposit_card' | 'balance' | 'deposit_cancel' | 'withdraw_form' | 'withdraw_bank_picker' | 'withdraw_confirm' | 'send_methods' | 'send_email_phone' | 'send_to_brics' | 'send_address' | 'send_amount' | 'send_recipient' | 'send_review' | 'send_success' | 'claim'
  const [view, setView] = useState("home")

  // Handle URL routes and PayFast return URLs
  useEffect(() => {
    if (typeof window === "undefined") return
    const path = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    
    if (path === "/balance") {
      setView("balance")
    } else if (path === "/deposit/cancel") {
      setView("deposit_cancel")
    } else if (path === "/claim" && params.get("code")) {
      setView("claim")
    }
  }, [])
  const [showWithdrawFlow, setShowWithdrawFlow] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [showSnackbar, setShowSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState("")
  const [openAccordion, setOpenAccordion] = useState(null)
  const [showCopyTooltip, setShowCopyTooltip] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [exceedsMax, setExceedsMax] = useState(false)

  const [withdraw, setWithdraw] = useState<Withdraw>({
    bank: "",
    amount: "",
    holder: "",
    accountType: "",
    branchCode: "",
    accountNumberRaw: "",
    country: "ZA",
  })

  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())

  const [bankSearch, setBankSearch] = useState("")

  const [lastWithdrawal, setLastWithdrawal] = useState<{
    amount: string
    bank: string
    accountNumber: string
    country: "ZA" | "MZ"
  } | null>(null)

  const [send, setSend] = useState<SendFlow>({
    address: "",
    network: "",
    amount: "",
    recipientType: "",
    recipientName: "",
    walletType: "",
    provider: "",
  })

  const [showBottomSheet, setShowBottomSheet] = useState<string | null>(null)
  const [providerSearch, setProviderSearch] = useState("")

  // Handle member data storage
  useEffect(() => {
    if (uid && email) {
      saveMember(uid, email, validSig(sig) ? sig : undefined)
    }
  }, [uid, email, sig])

  useEffect(() => {
    const id = getDemoUserId()
    setUserId(id)

    // Fetch balance from canonical /api/me endpoint (source of truth)
    // Only set balance if we get a valid number; never default to 0
    const fetchInitialBalance = async () => {
      try {
        const r = await fetch(`/api/me?userId=${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (r.ok) {
          const data = await r.json()
          // Read from canonical balances structure
          const usdt = Number(data?.balances?.USDT ?? data?.balanceUSDT ?? 0)
          if (isFinite(usdt) && usdt >= 0) {
            setBalance(usdt)
            // Optionally sync to localStorage for offline/cache (only after we have real value)
            if (usdt > 0) {
              setBalanceInStorage(id, usdt)
            }
          }
        }
        // Do not fallback to localStorage or DEMO_MODE on first paint - let BalancePage handle it
      } catch (e) {
        console.error('[App] Failed to fetch balance from Firestore', e)
        // Do not set 0 on error - let BalancePage handle the fetch
      }
    }

    fetchInitialBalance()
  }, [])

  useEffect(() => {
    // Sync balance state to localStorage as cache (Firestore remains source of truth)
    if (userId && balance !== null && balance !== undefined && balance > 0) {
      setBalanceInStorage(userId, balance)
    }
  }, [balance, userId])

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text)
    setSnackbarMessage("Copied!")
    setShowSnackbar(true)
    setTimeout(() => setShowSnackbar(false), 2000)
  }

  const handleCloseEmbed = () => {
    if (isEmbed && window.parent) {
      window.parent.postMessage({ type: 'brics:close' }, '*')
    }
  }

  const requireAuth = (next: () => void) => {
    if (isAuthed) return next()
    setPendingAction(() => next)
    setShowAuth(true)
  }

  const handleAuthSuccess = () => {
    setShowAuth(false)
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }

  const handleAuthClose = () => {
    setShowAuth(false)
    setPendingAction(null)
  }

  // Use useWallet hook for balance validation
  const { balances, refresh } = useWallet()

  const validateWithdrawForm = () => {
    const amount = Number(withdraw.amount)
    return (
      withdraw.bank.length > 0 &&
      amount > 0 &&
      amount <= balances.USDT &&
      withdraw.holder.length >= 2 &&
      withdraw.accountType.length > 0 &&
      withdraw.branchCode.length >= 3 &&
      withdraw.branchCode.length <= 8 &&
      withdraw.accountNumberRaw.length >= 6 &&
      withdraw.accountNumberRaw.length <= 16
    )
  }

  const handleWithdrawSubmit = async () => {
    const amount = Number(withdraw.amount)
    console.log('[WITHDRAW_SUBMIT]', { amount, available: balances.USDT })

    if (!validateWithdrawForm()) {
      console.log('[WITHDRAW_SUBMIT]', 'Validation failed')
      return
    }

    if (!user) {
      console.error('[WITHDRAW_SUBMIT]', 'User not authenticated')
      return
    }

    setIsProcessing(true)

    try {
      const idToken = await user.getIdToken()
      if (!idToken) throw new Error('Not signed in')

      const res = await fetch('/api/internal/withdraw/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amountUSDT: amount,
          bankName: withdraw.bank,
          accountType: withdraw.accountType,
          branchCode: withdraw.branchCode,
          accountNumber: withdraw.accountNumberRaw,
          accountHolder: withdraw.holder,
          country: withdraw.country,
        }),
      })

      const json = await res.json()

      if (!json.ok) {
        console.error('[WITHDRAW_SUBMIT]', 'API error:', json.error)
        setIsProcessing(false)
        return
      }

      // Refresh wallet to get latest balance after withdraw
      await refresh()
      console.log('[WITHDRAW_SUBMIT]', 'Success - refreshed wallet', { withdrawalId: json.id })

      const summary = {
        amount: withdraw.amount,
        bank: withdraw.bank,
        accountNumber: withdraw.accountNumberRaw,
        country: withdraw.country as "ZA" | "MZ",
      }

      setLastWithdrawal(summary)
      setIsProcessing(false)

      // clear form
      setWithdraw({
        bank: "",
        amount: "",
        holder: "",
        accountType: "",
        branchCode: "",
        accountNumberRaw: "",
        country: "ZA",
      })
      setTouchedFields(new Set())

      // Navigate to confirmation screen
      setView("withdraw_confirm")
    } catch (e: any) {
      console.error('[WITHDRAW_SUBMIT_ERROR]', e)
      setIsProcessing(false)
    }
  }

  // Show auth screen if needed
  if (showAuth) {
  return (
      <AuthScreen 
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
      />
    )
  }

  return (
    <div className={isEmbed ? "embed-root" : "app-root"}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} suppressHydrationWarning />

      <div className="app-container" data-embed={isEmbed ? "1" : "0"}>
        {isEmbed && (
          <button
            className="embed-close"
            onClick={handleCloseEmbed}
            aria-label="Close"
          >
            ✕
          </button>
        )}
        {view === "home" && !showWithdrawFlow && (
          <WalletUnconnected
            balance={balance}
            setView={setView}
            openAccordion={openAccordion}
            setOpenAccordion={setOpenAccordion as React.Dispatch<React.SetStateAction<string | null>>}
            requireAuth={requireAuth}
          />
        )}
        {view === "deposit_options" && (
          <DepositOptions
            setView={setView}
            setSnackbarMessage={setSnackbarMessage}
            setShowSnackbar={setShowSnackbar}
          />
        )}
        {view === "deposit_eft" && <EFTDetails setView={setView} handleCopy={handleCopy} />}
        {view === "deposit_card" && (
          <DepositCard
            userId={user?.uid || userId || (uid || "")}
            setView={setView}
            setSnackbarMessage={setSnackbarMessage}
            setShowSnackbar={setShowSnackbar}
          />
        )}
        {view === "balance" && (
          <BalancePage
            setView={setView}
            setBalance={setBalance}
            balance={balance}
            userId={user?.uid || userId || (uid || "")}
            requireAuth={requireAuth}
            openAccordion={openAccordion}
            setOpenAccordion={setOpenAccordion as React.Dispatch<React.SetStateAction<string | null>>}
          />
        )}
        {view === "deposit_cancel" && <DepositCancel setView={setView} />}
        {view === "withdraw_form" && (
          <WithdrawForm
            withdraw={withdraw}
            setWithdraw={setWithdraw}
            touchedFields={touchedFields}
            setTouchedFields={setTouchedFields}
            validateWithdrawForm={validateWithdrawForm}
            isProcessing={isProcessing}
            handleWithdrawSubmit={handleWithdrawSubmit}
            setView={setView}
          />
        )}
        {view === "withdraw_bank_picker" && (
          <BankPicker
            withdraw={withdraw}
            setWithdraw={setWithdraw}
            bankSearch={bankSearch}
            setBankSearch={setBankSearch}
            setView={setView}
          />
        )}
        {view === "withdraw_confirm" && (
          <WithdrawConfirm lastWithdrawal={lastWithdrawal} setView={setView} setLastWithdrawal={setLastWithdrawal} />
        )}
        {showWithdrawFlow && (
          <WithdrawFlow
            withdrawAmount={withdrawAmount}
            setWithdrawAmount={setWithdrawAmount}
            exceedsMax={exceedsMax}
            setExceedsMax={setExceedsMax}
            showCopyTooltip={showCopyTooltip}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            setShowSnackbar={setShowSnackbar}
            setSnackbarMessage={setSnackbarMessage}
            setShowWithdrawFlow={setShowWithdrawFlow}
            handleCopy={handleCopy}
          />
        )}

        {view === "send_methods" && (
          <SendMethods setView={setView} />
        )}
        {view === "send_email_phone" && (
          <SendEmailPhone setView={setView} />
        )}
        {view === "send_to_brics" && (
          <SendToBrics setView={setView} />
        )}
        {view === "claim" && (
          <Claim
            code={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('code') || ''}
            setView={setView}
          />
        )}
        {view === "send_address" && (
          <SendAddress
            send={send}
            setSend={setSend}
            setView={setView}
            balance={balance}
            showBottomSheet={showBottomSheet}
            setShowBottomSheet={setShowBottomSheet}
          />
        )}
        {view === "send_amount" && <SendAmount send={send} setSend={setSend} setView={setView} balance={balance} />}
        {view === "send_recipient" && (
          <SendRecipient
            send={send}
            setSend={setSend}
            setView={setView}
            balance={balance}
            showBottomSheet={showBottomSheet}
            setShowBottomSheet={setShowBottomSheet}
            providerSearch={providerSearch}
            setProviderSearch={setProviderSearch}
          />
        )}
        {view === "send_review" && (
          <SendReview
            send={send}
            setView={setView}
            balance={balance}
            setBalance={setBalance}
            setSnackbarMessage={setSnackbarMessage}
            setShowSnackbar={setShowSnackbar}
          />
        )}
        {view === "send_success" && <SendSuccess send={send} setView={setView} setSend={setSend} />}

        {showSnackbar && <div className="snackbar">{snackbarMessage}</div>}
      </div>
    </div>
  )
}
