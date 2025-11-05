import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const authz = req.headers.authorization || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const ref = req.query.ref as string;
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

    // Generate PDF using pdfkit
    const pdfBuffer = await generatePDF(withdrawalData);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="withdrawal-proof-${ref}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    res.status(200).send(pdfBuffer);
  } catch (e: any) {
    console.error('[withdraw/proof] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

async function generatePDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('BRICS Withdrawal Proof', { align: 'center' });
    doc.moveDown(2);

    // Reference
    doc.fontSize(12).text('Reference:', 50, doc.y);
    doc.text(data.id || 'N/A', { continued: true });
    doc.moveDown();

    // Amount
    const amount = data.amountCents ? (data.amountCents / 100).toFixed(2) : (data.amountUSDT || 0).toFixed(2);
    doc.text('Amount:', { continued: false });
    doc.text(`${amount} USDT`, { continued: true });
    doc.moveDown();

    // Bank details
    doc.text('Bank:', { continued: false });
    doc.text(data.bankName || 'N/A', { continued: true });
    doc.moveDown();

    doc.text('Account Holder:', { continued: false });
    doc.text(data.accountHolder || 'N/A', { continued: true });
    doc.moveDown();

    doc.text('Account Type:', { continued: false });
    doc.text(data.accountType || 'N/A', { continued: true });
    doc.moveDown();

    doc.text('Branch Code:', { continued: false });
    doc.text(data.branchCode || 'N/A', { continued: true });
    doc.moveDown();

    doc.text('Account Number:', { continued: false });
    doc.text(data.accountNumberMasked || data.accountNumberLast4 || 'N/A', { continued: true });
    doc.moveDown();

    doc.text('Country:', { continued: false });
    doc.text(data.country || 'N/A', { continued: true });
    doc.moveDown(2);

    // Date
    const date = data.createdAt?.toDate?.() || new Date();
    doc.text('Date:', { continued: false });
    doc.text(date.toISOString(), { continued: true });
    doc.moveDown();
    doc.text(`Local: ${date.toLocaleString()}`, { continued: false });

    doc.end();
  });
}

