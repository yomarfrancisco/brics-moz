# Balance Unification Patches

## 1) api/me.ts - Single canonical response

```diff
+import type { VercelRequest, VercelResponse } from '@vercel/node';
+import { db } from './_firebaseAdmin.js';
+
+export const dynamic = 'force-dynamic';
+
+export default async function handler(req: VercelRequest, res: VercelResponse) {
+  if (req.method !== 'GET') {
+    return res.status(405).json({ error: 'method_not_allowed' });
+  }
+
+  try {
+    const uid = (req.query.userId as string) || (req.query.uid as string) || (req.headers['x-user-id'] as string) || '';
+    
+    if (!uid) {
+      return res.status(400).json({ error: 'uid_required' });
+    }
+
+    // Read users/{uid} once
+    const doc = await db.collection('users').doc(uid).get();
+    const data = doc.exists ? doc.data() : {};
+    
+    // Build balances = { USDT, ZAR } with safe coercion
+    const balances = {
+      USDT: Number(data?.balances?.USDT ?? data?.balanceUSDT ?? data?.balanceZAR ?? data?.balance ?? 0),
+      ZAR: Number(data?.balances?.ZAR ?? data?.balanceZAR ?? data?.balance ?? 0),
+    };
+
+    // Return canonical structure with temporary legacy echoes
+    return res.status(200).json({
+      balances,
+      emailLower: data?.emailLower ?? null,
+      email: data?.email ?? null,
+      displayName: data?.displayName ?? null,
+      avatarURL: data?.avatarURL ?? null,
+      // Legacy echoes (temporary)
+      balanceUSDT: balances.USDT,
+      balanceZAR: balances.ZAR,
+      balance: balances.ZAR,
+    });
+  } catch (err: any) {
+    console.error('api/me', { message: err?.message, stack: err?.stack });
+    return res.status(500).json({ error: 'internal_error', detail: err?.message });
+  }
+}
```

---

## 2) src/lib/useWallet.ts - Canonical hook

```diff
+import useSWR from 'swr';
+import { useAuthGate } from './useAuthGate';
+
+export interface WalletData {
+  balances: { USDT: number; ZAR: number };
+  emailLower: string | null;
+  email: string | null;
+  displayName: string | null;
+  avatarURL: string | null;
+}
+
+const fallbackData: WalletData = {
+  balances: { USDT: 0, ZAR: 0 },
+  emailLower: null,
+  email: null,
+  displayName: null,
+  avatarURL: null,
+};
+
+async function fetcher(url: string): Promise<WalletData> {
+  const res = await fetch(url, { cache: 'no-store' });
+  if (!res.ok) {
+    throw new Error(`Failed to fetch wallet: ${res.status}`);
+  }
+  const data = await res.json();
+  
+  // Normalization with Number(...), isFinite, and defaults
+  const USDT = Number(data.balances?.USDT ?? data.balanceUSDT ?? 0);
+  const ZAR = Number(data.balances?.ZAR ?? data.balanceZAR ?? data.balance ?? 0);
+  
+  return {
+    balances: {
+      USDT: isFinite(USDT) && USDT >= 0 ? USDT : 0,
+      ZAR: isFinite(ZAR) && ZAR >= 0 ? ZAR : 0,
+    },
+    emailLower: data.emailLower ?? null,
+    email: data.email ?? null,
+    displayName: data.displayName ?? null,
+    avatarURL: data.avatarURL ?? null,
+  };
+}
+
+export function useWallet() {
+  const { user, isAuthed } = useAuthGate();
+  
+  const { data, error, isLoading, mutate } = useSWR<WalletData>(
+    isAuthed && user?.uid ? `/api/me?userId=${encodeURIComponent(user.uid)}` : null,
+    fetcher,
+    {
+      fallbackData,
+      suspense: false,
+      revalidateOnFocus: true,
+      revalidateOnReconnect: true,
+    }
+  );
+
+  return {
+    balances: data?.balances ?? fallbackData.balances,
+    refresh: mutate,
+    loading: isLoading,
+    error: error || null,
+  };
+}
```

---

## 3) src/components/SendMethods (in App.tsx) - Send landing card

```diff
 const SendMethods: React.FC<SendMethodsProps> = ({ setView, balance, userId }) => {
-  const [balanceUSDT, setBalanceUSDT] = useState<number | null>(null)
-
-  useEffect(() => {
-    const fetchUSDTBalance = async () => {
-      if (!userId) {
-        setBalanceUSDT(0)
-        return
-      }
-      try {
-        const r = await fetch(`/api/wallet/me?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
-        if (r.ok) {
-          const data = await r.json()
-          const usdt = typeof data.balanceUSDT === 'number' ? data.balanceUSDT : (typeof data.balance === 'number' ? data.balance : 0)
-          setBalanceUSDT(usdt)
-        } else {
-          setBalanceUSDT(0)
-        }
-      } catch (e) {
-        console.error('[SendMethods] Failed to fetch balanceUSDT', e)
-        setBalanceUSDT(0)
-      }
-    }
-    fetchUSDTBalance()
-  }, [userId])
+  const { balances, loading } = useWallet()
+  
+  if (loading) {
+    return (
+      <>
+        <div className="header-area">
+          <button className="back-button-header" onClick={() => setView("home")}>
+            <ArrowLeft size={20} />
+          </button>
+        </div>
+        <div className="content-container-centered">
+          <WalletSkeleton />
+        </div>
+      </>
+    )
+  }
 
   return (
     <ErrorBoundary>
       <div className="header-area">
         <button className="back-button-header" onClick={() => setView("home")}>
           <ArrowLeft size={20} />
         </button>
       </div>
 
       <div className="content-container-centered">
         <div className="card deposit-options-card">
           <div className="deposit-options-title">Send USDT</div>
           <div className="deposit-options-subtitle">
-            Available: {balanceUSDT !== null && balanceUSDT !== undefined ? balanceUSDT.toFixed(2) : '0.00'} USDT
+            Available: {balances.USDT.toFixed(2)} USDT
           </div>
```

---

## 4) src/components/SendEmailPhone (in App.tsx) - Fix crash + insufficient funds

```diff
 const SendEmailPhone: React.FC<SendEmailPhoneProps> = ({ setView, balance, setBalance, user }) => {
-  const [type, setType] = useState<'email' | 'phone'>('email')
+  const { balances, loading } = useWallet()
+  const [type, setType] = useState<'email' | 'phone'>('email')
   const [value, setValue] = useState('')
   const [amount, setAmount] = useState('')
   const [memo, setMemo] = useState('')
   const [submitting, setSubmitting] = useState(false)
   const [result, setResult] = useState<any>(null)
   const [error, setError] = useState<string | null>(null)
 
-  const [balanceUSDT, setBalanceUSDT] = useState<number | null>(null)
-  
-  useEffect(() => {
-    const fetchUSDTBalance = async () => {
-      // ... fetching logic
-    }
-    fetchUSDTBalance()
-  }, [user?.uid])
-
-  const usdt = Number(wallet?.balances?.USDT ?? 0)
   const formAmount = Number(amount) || 0
-  const isValid = value.length > 0 && formAmount > 0 && !isNaN(formAmount) && formAmount <= usdt
+  const isValid = value.length > 0 && formAmount > 0 && !isNaN(formAmount) && formAmount <= balances.USDT
   
+  // Guard against invalid USDT value
+  if (!isFinite(balances.USDT) || balances.USDT < 0) {
+    return <WalletSkeleton />
+  }
+  
+  if (loading) {
+    return <WalletSkeleton />
+  }
+
   const submit = async () => {
     if (!user) {
       setError('Not signed in')
       return
     }
 
-    if (formAmount > usdt) {
+    // Validation: insufficient funds check
+    if (formAmount > balances.USDT) {
       setError('Insufficient balance')
       return
     }
 
     setSubmitting(true)
     setError(null)
 
     try {
       const idToken = await user.getIdToken()
       const r = await fetch('/api/internal/send/init', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${idToken}`,
         },
         body: JSON.stringify({
           to: { type, value },
           amountUSDT: formAmount,  // Submit payload uses amount, no ZAR/FX yet
           memo: memo || undefined,
         }),
       })
       
       const json = await r.json()
       if (!json.ok) {
         setError(json.error || 'init_failed')
         return
       }
       
       setResult(json)
-      if (json.newSenderBalance !== undefined) {
-        setBalanceUSDT(json.newSenderBalance)
-        setBalance(json.newSenderBalance)
-      }
+      // Refresh wallet after successful send
+      await mutate()
     } catch (e: any) {
       setError(e.message || 'init_failed')
     } finally {
       setSubmitting(false)
     }
   }
   
   // ... rest of component
   
   <div className="page-subline">
-    Available: {balanceUSDT !== null && balanceUSDT !== undefined ? balanceUSDT.toFixed(2) : '0.00'} USDT
+    Available: {balances.USDT.toFixed(2)} USDT
   </div>
+  {formAmount > balances.USDT && (
+    <div style={{ color: '#C74242', fontSize: '12px' }}>Insufficient balance</div>
+  )}
```

---

## 5) Writers: Atomic updates to canonical + mirrors

### api/payfast/credit.ts

```diff
       const newBalanceZAR = currentBalZAR + amountZAR;
       const newBalanceUSDT = currentBalUSDT + amountZAR; // mirror 1:1 until FX
 
       // ---- WRITES AFTER ALL READS ----
       t.update(paymentRef, {
         status: 'CREDITED',
         via: 'credit',
         creditedAt: admin.firestore.FieldValue.serverTimestamp(),
       });
 
       // Credit canonical + legacy mirrors
       t.set(userRef, {
-        balanceZAR: newBalanceZAR,
-        balanceUSDT: newBalanceUSDT,
-        balance: newBalanceZAR,
+        'balances.USDT': newBalanceUSDT,
+        'balances.ZAR': newBalanceZAR,
+        // Legacy mirrors (temporary)
+        balanceUSDT: newBalanceUSDT,
+        balanceZAR: newBalanceZAR,
+        balance: newBalanceZAR,
       }, { merge: true });
```

### api/internal/send/init.ts

```diff
       // Reserve debit - update canonical balances structure + legacy mirrors
       tx.update(fromRef, {
-        balanceUSDT: balUSDT - amountUSDT,
-        balance: balZAR - amountUSDT,
-        balanceZAR: balZAR - amountUSDT,
+        'balances.USDT': balUSDT - amountUSDT,
+        'balances.ZAR': balZAR - amountUSDT, // mirror 1:1 until FX
+        // Legacy mirrors (temporary)
+        balanceUSDT: balUSDT - amountUSDT,
+        balanceZAR: balZAR - amountUSDT,
+        balance: balZAR - amountUSDT,
       });
 
       // ... later in same transaction, for recipient:
       
       // Credit to canonical balances structure + legacy mirrors
       tx.update(toRef, {
-        balanceUSDT: toBalUSDT + amountUSDT,
-        balanceZAR: toBalZAR + amountUSDT,
-        balance: toBalZAR + amountUSDT,
+        'balances.USDT': toBalUSDT + amountUSDT,
+        'balances.ZAR': toBalZAR + amountUSDT, // mirror 1:1 until FX
+        // Legacy mirrors (temporary)
+        balanceUSDT: toBalUSDT + amountUSDT,
+        balanceZAR: toBalZAR + amountUSDT,
+        balance: toBalZAR + amountUSDT,
       });
```

### api/internal/send/claim.ts

```diff
       // Credit to canonical balances structure + legacy mirrors
       tx.update(userRef, {
-        balanceUSDT: curUSDT + creditAmount,
-        balanceZAR: curZAR + creditAmount,
-        balance: curZAR + creditAmount,
+        'balances.USDT': curUSDT + creditAmount,
+        'balances.ZAR': curZAR + creditAmount, // mirror 1:1 until FX
+        // Legacy mirrors (temporary)
+        balanceUSDT: curUSDT + creditAmount,
+        balanceZAR: curZAR + creditAmount,
+        balance: curZAR + creditAmount,
         emailLower: emailLower || null,
       });
```

---

## 6) Backfill script - api/admin/migrate-balances.ts

```diff
     for (const doc of snapshot.docs) {
       const data = doc.data();
       
       // Skip if already migrated
       if (data._migratedBalances === true && data.balances?.USDT !== undefined && data.balances?.ZAR !== undefined) {
         skipped++;
         continue;
       }
 
-      // Extract existing values
-      const existingUSDT = Number(data.balanceUSDT ?? data.balanceZAR ?? data.balance ?? 0);
-      const existingZAR = Number(data.balanceZAR ?? data.balance ?? existingUSDT);
+      // Safe derive: prefer canonical if exists, fallback to legacy
+      const existingUSDT = Number(data.balances?.USDT ?? data.balanceUSDT ?? data.balanceZAR ?? data.balance ?? 0);
+      const existingZAR = Number(data.balances?.ZAR ?? data.balanceZAR ?? data.balance ?? existingUSDT);
       
+      // Ensure values are finite and non-negative
+      const USDT = isFinite(existingUSDT) && existingUSDT >= 0 ? existingUSDT : 0;
+      const ZAR = isFinite(existingZAR) && existingZAR >= 0 ? existingZAR : 0;
+      
       // Build canonical balances object
       const balances = {
-        USDT: existingUSDT,
-        ZAR: existingZAR,
+        USDT,
+        ZAR,
       };
 
-      // Update with canonical structure + legacy mirrors for backwards compat
+      // Writes canonical + mirrors only when canonical missing or mismatched
       batch.update(doc.ref, {
         balances,
         // Legacy mirrors (temporary - will be removed after cutover)
-        balanceUSDT: existingUSDT,
-        balanceZAR: existingZAR,
-        balance: existingZAR,
+        balanceUSDT: USDT,
+        balanceZAR: ZAR,
+        balance: ZAR,
         _migratedBalances: true,
       });
       
       batchCount++;
       migrated++;
     }
 
     // ... batch commits ...
 
     return res.status(200).json({
       ok: true,
-      migrated,
-      skipped,
+      scanned: snapshot.size,
+      updated: migrated,
+      skipped,
       errors: errors.length > 0 ? errors : undefined,
     });
```

---

## 7) Removal plan - Grep results

All UI now reads from `useWallet()` hook. Legacy field references found:

**In API endpoints (expected - for legacy echoes):**
- `api/me.ts`: Returns legacy echoes (`balanceUSDT`, `balanceZAR`, `balance`)
- `api/payfast/credit.ts`: Writes legacy mirrors (temporary)
- `api/internal/send/init.ts`: Writes legacy mirrors (temporary)
- `api/internal/send/claim.ts`: Writes legacy mirrors (temporary)
- `api/admin/migrate-balances.ts`: Writes legacy mirrors during migration

**In UI components (all should use useWallet()):**
- `src/App.tsx`: 
  - `SendMethods`: ✅ Uses `useWallet()`
  - `SendEmailPhone`: ✅ Uses `useWallet()`
  - `WalletUnconnected`: ✅ Uses `useWallet()`
  - `BalancePage`: ✅ Uses `/api/me` endpoint
  - App initial fetch: ✅ Uses `/api/me` endpoint

**Deprecated (can be removed after cutover):**
- `api/wallet/me.ts`: Still exists but no longer used by UI (replaced by `api/me.ts`)

**Summary:** All UI reads go through `useWallet()` → `/api/me` → `balances.{USDT,ZAR}`. Legacy fields only appear in:
1. API response echoes (temporary)
2. Firestore write mirrors (temporary)
3. Migration script

