import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import { renderWithdrawalPOP, type PopData } from '../../_pdfkit.js';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const ref = req.query.ref as string;
  console.log('[POP] start', { ref, method: req.method, url: req.url });

  try {
    const authz = req.headers.authorization || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    if (!ref) {
      return res.status(400).json({ ok: false, error: 'ref_required' });
    }

    // Fetch withdrawal details from Firestore
    const withdrawalRef = db.collection('withdrawals').doc(ref);
    const withdrawalDoc = await withdrawalRef.get();

    if (!withdrawalDoc.exists) {
      return res.status(404).json({ ok: false, error: 'withdrawal_not_found' });
    }

    const withdrawalData = withdrawalDoc.data()!;
    
    // Verify ownership
    if (withdrawalData.uid !== uid) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    // Fetch full account number from withdrawals_ops (if available)
    let accountNumber = withdrawalData.accountNumberMasked || withdrawalData.accountNumberLast4 || '';
    try {
      const opsRef = db.collection('withdrawals_ops').doc(ref);
      const opsDoc = await opsRef.get();
      if (opsDoc.exists) {
        const opsData = opsDoc.data()!;
        accountNumber = opsData.accountNumber || accountNumber;
      }
    } catch (e) {
      console.warn('[withdraw/proof] Failed to fetch ops doc for full account number:', e);
    }

    // Fetch user's handle
    let payerHandle = '@brics_unknown';
    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        const handle = userData.handle;
        if (handle) {
          payerHandle = `@${handle}`;
        }
      }
    } catch (e) {
      console.warn('[withdraw/proof] Failed to fetch user handle:', e);
    }

    // Format country name
    const countryMap: { [key: string]: string } = {
      ZA: 'South Africa',
      MZ: 'Mozambique',
    };
    const countryName = countryMap[withdrawalData.country] || withdrawalData.country || 'N/A';

    // Format amount (will be reformatted in popData)
    const amountUSDT = withdrawalData.amountCents ? (withdrawalData.amountCents / 100) : (withdrawalData.amountUSDT || 0);

    // Format dates
    const createdAt = withdrawalData.createdAt?.toDate?.() || new Date();
    
    // Format date as DD/MM/YYYY
    const formatDate = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Format time as HH:MM:SS Local
    const formatTime = (date: Date): string => {
      return `${date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Local`;
    };

    // Format amount: 6 decimals if < 1, else 2 decimals
    const amountNum = Number(amountUSDT);
    const amountFormatted = amountNum < 1 
      ? `${amountNum.toFixed(6)} USDT`
      : `${amountNum.toFixed(2)} USDT`;

    // Prepare PopData for PDFKit generator
    const popData: PopData = {
      date: formatDate(createdAt),
      timeLocal: formatTime(createdAt),
      reference: ref,
      recipient: withdrawalData.accountHolder || 'N/A',
      amount: amountFormatted,
      note: undefined, // Note not stored in withdrawal record currently
      bank: withdrawalData.bankName || 'N/A',
      accountNumber,
      country: countryName,
      payerHandle,
    };

    console.log('[POP] generating PDF', { ref, popData });

    // Generate PDF using PDFKit (pure Node.js, no JSX)
    const pdfBuffer = await renderWithdrawalPOP(popData);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BRICS-ProofOfPayment-${ref}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    
    console.log('[POP] success', { ref, bufferSize: pdfBuffer.length });

    res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error('[POP] failed', {
      ref,
      error: err,
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      code: err?.code,
    });
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send('POP generation failed');
  }
}


