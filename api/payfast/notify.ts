import type { VercelRequest, VercelResponse } from '@vercel/node';
import querystring from 'querystring';
import crypto from 'crypto';
import { getPayFastBase } from '../_payfast.js';
import { storeSet, storeEnabled, storeLog } from '../_store.js';

const ORIGIN = 'https://brics-moz.vercel.app';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Diagnostic: Log every notify attempt (even if it fails validation)
  const logTs = Date.now();
  await storeLog(`payfast:log:${logTs}`, {
    path: '/api/payfast/notify',
    stage: 'start',
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    },
  });

  // Initialize inside handler (no top-level execution)
  const MODE = process.env.PAYFAST_MODE ?? 'live';
  const PF_BASE = getPayFastBase(MODE);

  const MID = process.env.PAYFAST_MERCHANT_ID ?? '';
  const PPHR = process.env.PAYFAST_PASSPHRASE ?? '';

  try {
    if (req.method !== 'POST') {
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'method_not_allowed',
        method: req.method,
      });
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Read raw body FIRST before any parsing (critical for signature verification)
    // PayFast sends form-encoded POST; we need the exact raw string as sent
    // In Vercel, req.body may already be parsed for form-encoded, so we need to check
    let rawBody: string;
    if (typeof req.body === 'string') {
      // Raw body string (ideal case)
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      // Vercel parsed it - reconstruct preserving order if possible
      // Note: This fallback may not preserve exact order/encoding, but diagnostic logs will help
      rawBody = querystring.stringify(req.body as any);
      // Log warning that we're reconstructing (may affect signature)
      console.warn('payfast:notify', { context: 'body_reconstructed', note: 'Signature may fail if order/encoding differs' });
    } else {
      rawBody = '';
    }

    // Parse the raw body for field extraction
    const body = querystring.parse(rawBody);
    const params: Record<string, string> = Object.fromEntries(
      Object.entries(body || {}).map(([k, v]) => [k, String(v ?? '')])
    );
    const rawData = params; // Keep for compatibility with rest of code

    // Extract received signature (case-insensitive)
    const receivedSignature = String(params.signature || '').toLowerCase();

    // Build signature base per PayFast spec:
    // 1. Exclude signature parameter
    // 2. Sort keys alphabetically
    // 3. Build key=value pairs with URL-encoded values
    // 4. Append &passphrase=<encoded>
    const entries = Object.entries(params).filter(([k]) => k.toLowerCase() !== 'signature');
    const sortedKeys = entries.map(([k]) => k).sort();
    
    // Rebuild object in sorted order
    const sortedObj: Record<string, string> = {};
    for (const k of sortedKeys) {
      sortedObj[k] = String(params[k] ?? '');
    }

    // Build RFC3986 signature base (spaces as %20)
    let sigBaseRFC3986 = sortedKeys
      .map((k) => `${k}=${encodeURIComponent(sortedObj[k])}`)
      .join('&');
    
    if (PPHR) {
      sigBaseRFC3986 += `&passphrase=${encodeURIComponent(PPHR)}`;
    }

    // Build PHP-style signature base (spaces as +)
    let sigBasePHPStyle = sortedKeys
      .map((k) => `${k}=${encodeURIComponent(sortedObj[k]).replace(/%20/g, '+')}`)
      .join('&');
    
    if (PPHR) {
      sigBasePHPStyle += `&passphrase=${encodeURIComponent(PPHR).replace(/%20/g, '+')}`;
    }

    // Compute both MD5 hashes
    const computedSignatureRFC3986 = crypto.createHash('md5').update(sigBaseRFC3986).digest('hex').toLowerCase();
    const computedSignaturePHPStyle = crypto.createHash('md5').update(sigBasePHPStyle).digest('hex').toLowerCase();
    
    // Accept if either encoding matches
    const matchRFC3986 = computedSignatureRFC3986 === receivedSignature;
    const matchPHPStyle = computedSignaturePHPStyle === receivedSignature;
    const match = matchRFC3986 || matchPHPStyle;
    const matchedEncoding = matchRFC3986 ? 'RFC3986' : (matchPHPStyle ? 'PHP-style' : 'none');

    console.log('payfast:notify', { 
      ref: rawData.custom_str2 || rawData.m_payment_id || 'unknown', 
      match,
      matchedEncoding,
      sigBaseLength: sigBaseRFC3986.length,
      sortedKeysCount: sortedKeys.length
    });

    // 1) Basic merchant check
    if (rawData.merchant_id !== MID) {
      console.error('payfast:notify', { error: 'bad_merchant', merchant_id: rawData.merchant_id, context: 'validation' });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_merchant',
        received_merchant_id: rawData.merchant_id,
        expected_merchant_id: MID,
        payload: rawData,
      });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad merchant' });
    }

    // 2) Signature verification (dual-encoding: RFC3986 and PHP-style)
    const sigOk = match;
    let serverValid = false;
    let validateText = '';
    let validateHttpStatus = 0;
    let acceptedVia: 'signature' | 'server_validation' = 'signature';

    // 3) If signature fails, try PayFast server-validation as fallback
    if (!sigOk) {
      console.log('payfast:notify', { context: 'signature_failed_trying_server_validation', ref: rawData.custom_str2 || rawData.m_payment_id || 'unknown' });
      
      const VALIDATE_URL = MODE === 'sandbox'
        ? 'https://sandbox.payfast.co.za/eng/query/validate'
        : 'https://www.payfast.co.za/eng/query/validate';
      
      try {
        const validateRes = await fetch(VALIDATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: rawBody, // IMPORTANT: send the original raw body exactly as received
        });
        
        validateHttpStatus = validateRes.status;
        validateText = (await validateRes.text()).trim();
        serverValid = validateText === 'VALID';
        
        await storeLog(`payfast:log:${logTs}`, {
          stage: 'validate',
          result: validateText,
          httpStatus: validateHttpStatus,
          ref: rawData.custom_str2 || rawData.m_payment_id || '',
          serverValid,
        });
        
        if (serverValid) {
          acceptedVia = 'server_validation';
          console.log('payfast:notify', { context: 'server_validation_succeeded', ref: rawData.custom_str2 || rawData.m_payment_id || 'unknown' });
        }
      } catch (e: any) {
        console.error('payfast:notify', { 
          message: e?.message, 
          stack: e?.stack,
          context: 'payfast_validate_error' 
        });
        await storeLog(`payfast:log:${logTs}`, {
          stage: 'validate_error',
          error: String(e?.message),
          stack: e?.stack,
          ref: rawData.custom_str2 || rawData.m_payment_id || '',
        });
      }
    }

    // Reject only if both signature AND server-validation fail
    if (!sigOk && !serverValid) {
      console.error('payfast:notify', { error: 'bad_signature', context: 'validation', sigOk, serverValid });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_signature',
        sigOk,
        serverValid,
        validateText,
        validateHttpStatus,
        computedSignatureRFC3986,
        computedSignaturePHPStyle,
        receivedSignature,
        sortedKeys,
        sigBaseRFC3986Preview: sigBaseRFC3986.substring(0, 300),
        sigBasePHPStylePreview: sigBasePHPStyle.substring(0, 300),
        payment_status: params.payment_status,
        pf_payment_id: params.pf_payment_id,
        m_payment_id: params.m_payment_id,
        payload: rawData,
      });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad signature' });
    }

    // 4) Handle status (only reached if validation passed)
    const status = rawData.payment_status || '';
    const ref = rawData.custom_str2 || rawData.m_payment_id || '';
    const userId = rawData.custom_str1 || '';
    const amountGross = rawData.amount_gross || rawData.amount || '';
    const payerEmail = rawData.email_address || rawData.payer_email || '';

    // Map PayFast status to our status
    let mappedStatus: 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'PENDING' = 'PENDING';
    if (status === 'COMPLETE') {
      mappedStatus = 'COMPLETE';
    } else if (status === 'CANCELLED') {
      mappedStatus = 'CANCELLED';
    } else if (status === 'FAILED' || status === 'ABORTED') {
      mappedStatus = 'FAILED';
    }

    console.info('payfast:notify', { status, ref, userId, amount: amountGross, validated, context: 'itn_received' });

    // Store status in Upstash Redis
    let storeResult: 'success' | 'failed' | 'disabled' = 'disabled';
    const savedObject = {
      status: mappedStatus,
      amount_gross: amountGross,
      payer_email: payerEmail,
      updated_at: Date.now(),
      raw: rawData
    };
    
    if (storeEnabled()) {
      try {
        await storeSet(ref, savedObject);
        storeResult = 'success';
        
        // Diagnostic: Log persistence details
        await storeLog(`payfast:log:${logTs}`, {
          stage: 'persisted',
          ref,
          fields: Object.keys(savedObject),
          storage: 'HSET json',
          status: mappedStatus,
          amount_gross: amountGross,
        });
      } catch (e: any) {
        console.error('payfast:notify', { message: e?.message, stack: e?.stack, context: 'store_error' });
        storeResult = 'failed';
      }
    } else {
      console.warn('payfast:notify', { context: 'STORE_DISABLED: ITN not persisted' });
    }

    // Diagnostic: Log successful validation and persistence outcome
    await storeLog(`payfast:log:${logTs}`, {
      stage: 'verdict',
      verdict: 'accepted',
      reason: 'ok',
      via: acceptedVia,
      sigOk,
      serverValid,
      validateText: validateText || (sigOk ? 'not_called' : 'unknown'),
      validateHttpStatus: validateHttpStatus || (sigOk ? 0 : 0),
      receivedSignature,
      computedSignatureRFC3986,
      computedSignaturePHPStyle,
      matchedEncoding: sigOk ? matchedEncoding : 'server_validation',
      sortedKeys,
      sigBaseRFC3986Preview: sigBaseRFC3986.substring(0, 300),
      sigBasePHPStylePreview: sigBasePHPStyle.substring(0, 300),
      ref,
      status: mappedStatus,
      amount: amountGross,
      userId,
      payerEmail,
      storeResult,
      payment_status: params.payment_status,
      pf_payment_id: params.pf_payment_id,
      m_payment_id: params.m_payment_id,
      payload: rawData,
    });

    return res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    console.error('payfast:notify', { message: err?.message, stack: err?.stack });
    await storeLog(`payfast:log:${logTs}`, {
      stage: 'verdict',
      verdict: 'rejected',
      reason: 'exception',
      error: err?.message,
      stack: err?.stack,
    });
    cors(res);
    return res.status(500).json({ error: 'SERVER', detail: 'internal error' });
  }
}
