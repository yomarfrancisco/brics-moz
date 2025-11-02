# PayFast Process Optimization Strategies

## 1. Optimistic Balance Updates + LocalStorage Recovery

**Problem**: Users wait 180s for ITN, balance only updates when status becomes COMPLETE.

**Solution**: 
- Store pending payment in localStorage when redirecting to PayFast
- On app mount, check all pending refs and update balance
- Show balance increase immediately when returning from PayFast (before ITN confirms)

**Implementation**:
```typescript
// In DepositCard, before redirect:
localStorage.setItem(`payfast:pending:${ref}`, JSON.stringify({
  ref,
  amount,
  userId,
  createdAt: Date.now()
}));

// In App.tsx mount:
useEffect(() => {
  // Check all pending payments
  const pendingKeys = Object.keys(localStorage).filter(k => k.startsWith('payfast:pending:'));
  pendingKeys.forEach(async (key) => {
    const pending = JSON.parse(localStorage.getItem(key)!);
    const status = await fetch(`/api/payfast/status?ref=${pending.ref}`);
    if (status.status === 'COMPLETE') {
      // Update balance and remove from pending
      updateBalance(pending.userId, pending.amount);
      localStorage.removeItem(key);
    }
  });
}, []);
```

## 2. Background Polling with Page Visibility API

**Problem**: Polling stops if user switches tabs or minimizes browser.

**Solution**: Continue polling in background, but reduce frequency when tab is hidden.

```typescript
// In DepositSuccess.tsx:
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab hidden: poll every 10s instead of 2s
      pollInterval = 10000;
    } else {
      // Tab visible: poll every 2s
      pollInterval = 2000;
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

## 3. Exponential Backoff Polling

**Problem**: Wasteful to poll every 2s for 180s if ITN takes 5 minutes.

**Solution**: Start at 2s, back off to 5s, then 10s, max 30s.

```typescript
const getPollInterval = (pollCount: number) => {
  if (pollCount < 10) return 2000;      // First 20s: 2s
  if (pollCount < 25) return 5000;      // Next 75s: 5s
  if (pollCount < 50) return 10000;     // Next 250s: 10s
  return 30000;                          // After: 30s
};
```

## 4. Check Return URL Parameters

**Problem**: PayFast may pass payment_status in return URL, but we ignore it.

**Solution**: Parse return URL for immediate status hint.

```typescript
// In DepositSuccess.tsx:
const urlParams = new URLSearchParams(window.location.search);
const payfastStatus = urlParams.get('payment_status');
const pfPaymentId = urlParams.get('pf_payment_id');

// If PayFast says COMPLETE in URL, be optimistic but still verify
if (payfastStatus === 'COMPLETE') {
  setStatus('COMPLETE'); // Optimistic
  // Still poll to confirm from our backend
}
```

## 5. Batch Status Check on App Mount

**Problem**: If user closes tab and reopens later, they lose polling progress.

**Solution**: On app mount, check all localStorage pending payments at once.

```typescript
// In App.tsx:
useEffect(() => {
  const checkPendingPayments = async () => {
    const pendingKeys = Object.keys(localStorage).filter(k => k.startsWith('payfast:pending:'));
    if (pendingKeys.length === 0) return;
    
    const refs = pendingKeys.map(k => JSON.parse(localStorage.getItem(k)!).ref);
    // Batch check all refs
    const results = await Promise.all(
      refs.map(ref => fetch(`/api/payfast/status?ref=${ref}`).then(r => r.json()))
    );
    
    results.forEach((result, i) => {
      if (result.status === 'COMPLETE') {
        const pending = JSON.parse(localStorage.getItem(pendingKeys[i])!);
        updateBalance(pending.userId, pending.amount);
        localStorage.removeItem(pendingKeys[i]);
      }
    });
  };
  
  checkPendingPayments();
}, []);
```

## 6. WebSocket/SSE for Real-Time Updates (Advanced)

**Problem**: Polling is wasteful and delayed.

**Solution**: Use WebSocket or Server-Sent Events for push notifications.

```typescript
// In notify.ts, after storing COMPLETE:
// Emit event to connected clients via WebSocket
// Or use Server-Sent Events (SSE) endpoint

// Client subscribes:
const eventSource = new EventSource(`/api/payfast/events?ref=${ref}`);
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.status === 'COMPLETE') {
    updateBalance(data.amount);
  }
};
```

## 7. Service Worker for Background Sync

**Problem**: No polling if browser closed.

**Solution**: Service Worker checks status in background, sends notification when ready.

**Note**: Requires HTTPS, more complex setup.

## 8. Aggressive Retry Logic

**Problem**: Single ITN callback may fail due to network issues.

**Solution**: PayFast retries ITN, but we can also proactively check.

```typescript
// After 30s of pending, proactively check PayFast status
// (if PayFast provides a status API endpoint)
```

## 9. Hybrid Approach: Optimistic + Verification

**Best of both worlds**:
1. Show balance increase immediately when user returns from PayFast (optimistic)
2. Keep polling in background to verify
3. If ITN says FAILED, rollback the optimistic update
4. Use localStorage as source of truth until backend confirms

## 10. Smart Status Caching

**Problem**: Multiple tabs polling same ref wastes API calls.

**Solution**: Share status via BroadcastChannel or localStorage events.

```typescript
// In DepositSuccess.tsx:
const channel = new BroadcastChannel('payfast-status');
channel.onmessage = (e) => {
  if (e.data.ref === ref && e.data.status === 'COMPLETE') {
    setStatus('COMPLETE');
  }
};

// When status changes, broadcast:
channel.postMessage({ ref, status });
```

---

## Recommended Quick Wins

1. **#1 (Optimistic + localStorage)** - Easiest, biggest UX improvement
2. **#4 (Return URL parsing)** - Free data from PayFast
3. **#5 (Batch check on mount)** - Solves the "closed tab" problem
4. **#3 (Exponential backoff)** - Reduces server load

## Implementation Priority

1. **Now**: Add localStorage pending payments tracking
2. **Next**: Parse return URL parameters  
3. **Later**: Batch status check on mount
4. **Future**: WebSocket/SSE for real-time
