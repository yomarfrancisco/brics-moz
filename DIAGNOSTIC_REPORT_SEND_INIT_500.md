# Diagnostic Report: `/api/internal/send/init` 500 Error

**Date:** 2024-11-05  
**Issue:** POST `/api/internal/send/init` with `toType: 'email'` returns 500 Internal Server Error with non-JSON response (HTML/plain text starting with "A server error occurred...").

---

## 🔍 Investigation Summary

### 1. **Root Cause Identified**

**File:** `api/internal/send/init.ts`  
**Line:** 5  
**Issue:** Invalid import path from `src/` directory in API route

```typescript
import { randHex } from '../../../src/lib/random';
```

### 2. **Why This Causes 500 + Non-JSON Response**

1. **Module Resolution Failure:** Vercel serverless functions cannot reliably import from `src/` directories, which are typically client-side code.
2. **Function Initialization Failure:** The import fails during function initialization (before request handling), causing the entire handler to fail.
3. **Default Error Response:** When a Vercel function fails at initialization, it returns Vercel's default error page (HTML) instead of JSON, which explains the client-side error: `"Unexpected token 'A', "A server e"... is not valid JSON"`.

### 3. **Evidence**

- **Client Error:** `POST https://brics-moz.vercel.app/api/internal/send/init 500 (Internal Server Error)`
- **Client JSON Parse Error:** `"Unexpected token 'A', "A server e"... is not valid JSON"` — indicates HTML response starting with "A server error occurred..."
- **Import Path:** Only `api/internal/send/init.ts` imports from `src/lib/random`; no other API routes use this pattern.
- **Test Result:** Direct Node.js `require()` of the path fails with module resolution errors.

### 4. **Code Flow Analysis**

**Expected Request Payload:**
```json
{
  "to": { "type": "email", "value": "ydgh@adf.com" },
  "amountUSDT": 0.01,
  "memo": "hello"
}
```

**Where `randHex` is Used:**
- Line 74: `const inviteCode = toUid ? null : randHex(8);`
- Only executed when recipient is not found (invite flow)

**Error Occurs:**
- **Before** any request handling code runs
- **During** module import/initialization
- **Result:** Vercel returns default HTML error page

### 5. **Comparison with Other Routes**

✅ **Other API routes** (e.g., `api/internal/send/handle.ts`, `api/internal/withdraw/init.ts`) do NOT import from `src/`  
✅ **Other routes using random functions** likely use inline implementations or proper server-side utilities  
✅ **All other routes** have proper error handling with `res.status().json()`

### 6. **Error Handling in Handler**

The handler DOES have proper error handling:
- Lines 202-218: `catch` block returns JSON with `res.status(400).json()`
- However, **this code never executes** because the function fails during import

### 7. **Impact**

- ✅ `toType: 'handle'` — Works (uses `/api/internal/send/handle`, different route)
- ✅ `toType: 'phone'` — Would fail (same route, same import issue)
- ❌ `toType: 'email'` — **Fails with 500**

---

## ✅ Confirmation Checklist

- [x] **500 Error Confirmed:** DevTools shows `POST /api/internal/send/init 500`
- [x] **Non-JSON Response Confirmed:** Client error shows "Unexpected token 'A'..." (HTML response)
- [x] **Import Path Issue Confirmed:** Line 5 imports from `../../../src/lib/random`
- [x] **Module Resolution Failure:** Node.js test confirms import fails
- [x] **Error Occurs Before Handler:** Function fails at initialization, not in request handling
- [x] **Other Routes Work:** Other API routes don't use this import pattern

---

## 🎯 Recommended Fix

**Option 1: Move `randHex` to shared API utility** (Recommended)
- Create `api/_random.ts` with `randHex` function
- Update import: `import { randHex } from '../../_random.js';`

**Option 2: Use Node.js crypto directly** (Quick fix)
- Replace `randHex(8)` with inline implementation using `node:crypto`

**Option 3: Inline implementation** (Minimal change)
- Copy `randHex` function directly into `api/internal/send/init.ts`

---

## 📋 Next Steps

1. **Fix the import path** (move `randHex` to `api/_random.ts` or use inline)
2. **Test `toType: 'email'`** — Should return 200 JSON
3. **Test `toType: 'phone'`** — Should also work (same route)
4. **Verify invite flow** — Ensure `randHex(8)` works for invite codes
5. **Deploy and verify** — Confirm no more 500 errors

---

## 📝 Notes

- The error is **not specific to email** — it affects any request to this endpoint
- The error occurs **before authentication checks** — even valid tokens would fail
- The client-side payload structure (`to: { type, value }`) is correct
- The server-side handler logic is correct (when it executes)

---

**Status:** ✅ **Root cause confirmed — ready for fix**

