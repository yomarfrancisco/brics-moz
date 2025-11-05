import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

export type PopData = {
  ref: string;
  dateISO: string;          // e.g., '2025-11-05T12:34:56Z'
  amount: string;           // e.g., '0.010000 USDT'
  bank: string;
  accountHolder: string;
  accountType: string;
  branchCode: string;
  accountNumber: string;
  country: string;
  paidFromAccountHolder: string; // e.g., '@brics_abc123' or 'BRICS Protocol'
};

export function renderWithdrawalPOP(data: PopData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 36, bottom: 36, left: 36, right: 36 } 
    });

    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const GREY = '#6B7280';
    const LINE = '#E5E7EB';
    const BOLD = 'Helvetica-Bold';
    const REG = 'Helvetica';

    // --- Header logo
    try {
      const logoPath = path.resolve(process.cwd(), 'public/assets/doll-regulator-small.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 36, 36, { width: 70 });
      }
    } catch (e) {
      console.warn('[pdfkit] Failed to load logo:', e);
    }

    // Horizontal rule under logo (at ~110px from top)
    const dividerY = 110;
    doc
      .moveTo(36, dividerY)
      .lineTo(doc.page.width - 36, dividerY)
      .lineWidth(1)
      .strokeColor(LINE)
      .stroke();

    // Heading
    doc
      .font(BOLD)
      .fontSize(18)
      .fillColor('black')
      .text('NOTICE: Notification of payment', 36, dividerY + 12);

    // Intro sentence
    doc
      .font(REG)
      .fontSize(11)
      .fillColor('#111827')
      .text(
        'Please find the details of your withdrawal below. Keep this document as proof of payment.',
        36,
        doc.y + 6,
        { width: doc.page.width - 72, lineGap: 2 }
      );

    // Table (labels left, values right)
    const startY = doc.y + 12;
    const labelX = 36;
    const valueX = 220; // Fixed position for values column
    let y = startY;

    const row = (label: string, value: string) => {
      const rowHeight = 18;
      
      // Label (left, grey, uppercase)
      doc
        .font(REG)
        .fontSize(10.5)
        .fillColor(GREY)
        .text(label.toUpperCase(), labelX, y, { 
          width: valueX - labelX - 8,
          align: 'left'
        });

      // Value (right, black, bold)
      doc
        .font('Courier')
        .fontSize(11.5)
        .fillColor('black')
        .text(value, valueX, y, { 
          align: 'right', 
          width: doc.page.width - valueX - 36 
        });

      // Bottom line (hairline)
      const lineY = y + rowHeight;
      doc
        .moveTo(36, lineY)
        .lineTo(doc.page.width - 36, lineY)
        .lineWidth(0.8)
        .strokeColor(LINE)
        .stroke();

      y = lineY + 4;
    };

    // Format date from ISO string
    const formatDate = (isoString: string): string => {
      try {
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return isoString.slice(0, 10);
      }
    };

    const formatTime = (isoString: string): string => {
      try {
        const date = new Date(isoString);
        return `${date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Local`;
      } catch {
        return 'N/A';
      }
    };

    // Payment Details Section
    row('Date of Payment', formatDate(data.dateISO));
    row('Time of Payment', formatTime(data.dateISO));
    row('Reference Number', data.ref);

    // Beneficiary details section
    doc
      .font(BOLD)
      .fontSize(12)
      .fillColor('black')
      .text('Beneficiary details', 36, y + 4);
    y += 20;

    row('Recipient', data.accountHolder);
    row('Amount', data.amount);
    row('Bank', data.bank);
    row('Account Number', data.accountNumber);
    row('Country', data.country);

    // Payer details section
    doc
      .font(BOLD)
      .fontSize(12)
      .fillColor('black')
      .text('Payer details', 36, y + 4);
    y += 20;

    row('Paid from Account Holder', data.paidFromAccountHolder);

    // Legal blurb
    doc.moveDown(2);
    doc
      .font(REG)
      .fontSize(9.5)
      .fillColor(GREY)
      .text(
        'BRICS and its partner banks will never send you an e-mail link to verify payments, always go to https://www.brics.ninja/ and log in to verify a payment.\n\n' +
        'This notification of payment is sent to you by BRICS is a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024). For any enquiries, please contact BRICS Contact Centre on "+2760 867 8513" or via email at "info@brics.ninja". Please contact the payer for enquiries regarding the contents of this notification.\n\n' +
        'BRICS will not be held responsible for the accuracy of the information on this notification and we accept no liability whatsoever arising from the transmission and use of the information. Payments may take up to three business days. Please check your account to verify the existence of the funds.\n\n' +
        'Note: We as a bank will never send you an e-mail requesting you to enter your personal details or private identification and authentication details.\n\n' +
        'Nedbank Limited email\n\n' +
        'The information contained in this email and any attachments is private and protected by law. If you are not the intended recipient, you are requested to delete this entire communication immediately and are notified that any disclosure, copying or distribution of or taking any action based on this information is prohibited. Emails cannot be guaranteed to be secure or free of errors or viruses. The sender does not accept any liability or responsibility for any interception, corruption, destruction, loss, late arrival or incompleteness of or tampering or interference with any of the information contained in this email or for its incorrect delivery or non-delivery for whatsoever reason or for its effect on any electronic device of the recipient. If verification of this email or any attachment is required, please request a hard copy version.',
        { width: doc.page.width - 72, lineGap: 2 }
      );

    doc.end();
  });
}

