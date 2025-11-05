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
  paidFromAccountHolder: string; // e.g., '@brics_abc123'
  note?: string;            // optional memo
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

    // Typography constants
    const TITLE_SIZE = 14;
    const SECTION_HEADING_SIZE = 11;
    const BODY_SIZE = 10;
    const LINE_HEIGHT = 13.5; // 1.35× for 10pt
    const ROW_HEIGHT = 14;
    const BLACK = '#000000';
    const DARK_GREY = '#111111';
    
    // Fonts (Helvetica family as Inter fallback)
    const BOLD = 'Helvetica-Bold';
    const REGULAR = 'Helvetica';
    const SEMI_BOLD = 'Helvetica-Bold'; // PDFKit doesn't have semi-bold, use bold for values

    // --- Header: Logo top-left
    let currentY = 36;
    try {
      // Try public path first (serverless-friendly)
      const publicLogoPath = path.resolve(process.cwd(), 'public/img/dall-regulator-small.png');
      const srcLogoPath = path.resolve(process.cwd(), 'src/assets/doll regulator_small.png');
      
      let logoPath: string | null = null;
      if (fs.existsSync(publicLogoPath)) {
        logoPath = publicLogoPath;
      } else if (fs.existsSync(srcLogoPath)) {
        logoPath = srcLogoPath;
      }
      
      if (logoPath) {
        doc.image(logoPath, 36, currentY, { height: 24 });
        console.log('[pdfkit] Logo loaded from:', logoPath);
      } else {
        console.warn('[pdfkit] Logo not found at either path');
      }
    } catch (e) {
      console.warn('[pdfkit] Failed to load logo:', e);
    }

    // Horizontal rule under logo (hairline, full width)
    currentY = 36 + 24 + 10; // logo height + spacing
    doc
      .moveTo(36, currentY)
      .lineTo(doc.page.width - 36, currentY)
      .lineWidth(0.5)
      .strokeColor('#E5E7EB')
      .stroke();

    // Title + intro (12pt spacing below rule)
    currentY += 12;
    doc
      .font(BOLD)
      .fontSize(TITLE_SIZE)
      .fillColor(BLACK)
      .text('Notification of payment', 36, currentY);

    // Intro paragraph (6-8pt spacing after title)
    currentY += TITLE_SIZE + 8;
    doc
      .font(REGULAR)
      .fontSize(BODY_SIZE)
      .fillColor(DARK_GREY)
      .text(
        'BRICS, a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024), confirm that the following payment has been made:',
        36,
        currentY,
        { 
          width: doc.page.width - 72,
          lineGap: 2,
          align: 'left'
        }
      );

    // Two-column details table (12pt spacing after intro)
    currentY = doc.y + 12;
    const labelX = 36;
    const labelWidth = 155;
    const valueX = labelX + labelWidth + 8;
    const valueWidth = doc.page.width - valueX - 36;

    // Helper function for table rows (no borders, spacing-based)
    const addRow = (label: string, value: string, isSectionHeading = false) => {
      if (isSectionHeading) {
        // Section heading (12pt gap above)
        currentY += 12;
        doc
          .font(BOLD)
          .fontSize(SECTION_HEADING_SIZE)
          .fillColor(BLACK)
          .text(label, labelX, currentY);
        currentY += SECTION_HEADING_SIZE + 4;
      } else {
        // Regular row
        doc
          .font(REGULAR)
          .fontSize(BODY_SIZE)
          .fillColor(DARK_GREY)
          .text(label, labelX, currentY, { width: labelWidth });
        
        doc
          .font(SEMI_BOLD)
          .fontSize(BODY_SIZE)
          .fillColor(BLACK)
          .text(value, valueX, currentY, { 
            width: valueWidth,
            align: 'left' // Left-aligned values (not right)
          });
        
        currentY += ROW_HEIGHT;
      }
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

    // Payment Details Rows
    addRow('Date of Payment', formatDate(data.dateISO));
    addRow('Time of Payment', formatTime(data.dateISO));
    addRow('Reference Number', data.ref);

    // Beneficiary details section
    addRow('Beneficiary details', '', true);
    addRow('Recipient', data.accountHolder);
    addRow('Amount', data.amount);
    
    // Note (only if present)
    if (data.note) {
      addRow('Note', data.note);
    }
    
    addRow('Bank', data.bank);
    addRow('Account Number', data.accountNumber);
    addRow('Country', data.country);

    // Payer details section
    addRow('Payer details', '', true);
    addRow('Paid from Account Holder', data.paidFromAccountHolder);

    // Anti-phishing note (14pt spacing above)
    currentY += 14;
    doc
      .font(REGULAR)
      .fontSize(BODY_SIZE)
      .fillColor(DARK_GREY)
      .text(
        'BRICS and its partner banks will never send you an e-mail link to verify payments, always go to https://www.brics.ninja/ and log in to verify a payment.',
        36,
        currentY,
        { 
          width: doc.page.width - 72,
          align: 'left',
          lineGap: 2
        }
      );

    // Legal + footer prose (14pt spacing after anti-phishing note)
    currentY = doc.y + 14;
    
    // First paragraph: BRICS notification
    doc
      .font(REGULAR)
      .fontSize(BODY_SIZE)
      .fillColor(DARK_GREY)
      .text(
        'This notification of payment is sent to you by BRICS, a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024). Enquiries regarding this payment notification should be directed to the BRICS Contact Centre on +2760 867 8513. Alternatively via email on info@brics.ninja. Please contact the payer for enquiries regarding the contents of this notification.',
        36,
        currentY,
        { 
          width: doc.page.width - 72,
          align: 'left',
          lineGap: 2
        }
      );

    // Liability paragraph (10-12pt spacing)
    currentY = doc.y + 12;
    doc
      .font(REGULAR)
      .fontSize(BODY_SIZE)
      .fillColor(DARK_GREY)
      .text(
        'BRICS will not be held responsible for the accuracy of the information on this notification and we accept no liability whatsoever arising from the transmission and use of the information. Payments may take up to three business days. Please check your account to verify the existence of the funds.',
        36,
        currentY,
        { 
          width: doc.page.width - 72,
          align: 'left',
          lineGap: 2
        }
      );

    // "Note: We as a bank..." paragraph (10-12pt spacing)
    currentY = doc.y + 12;
    doc
      .font(REGULAR)
      .fontSize(BODY_SIZE)
      .fillColor(DARK_GREY)
      .text(
        'Note: We as a bank will never send you an e-mail requesting you to enter your personal details or private identification and authentication details.',
        36,
        currentY,
        { 
          width: doc.page.width - 72,
          align: 'left',
          lineGap: 2
        }
      );

    // "Nedbank Limited email" heading (bold, 10-12pt spacing)
    currentY = doc.y + 12;
    doc
      .font(BOLD)
      .fontSize(BODY_SIZE)
      .fillColor(BLACK)
      .text('Nedbank Limited email', 36, currentY);

    // Confidentiality paragraph (immediately after heading)
    currentY += BODY_SIZE + 4;
    doc
      .font(REGULAR)
      .fontSize(BODY_SIZE)
      .fillColor(DARK_GREY)
      .text(
        'This email and any accompanying attachments may contain confidential and proprietary information. This information is private and protected by law and, accordingly, if you are not the intended recipient, you are requested to delete this entire communication immediately and are notified that any disclosure, copying or distribution of or taking any action based on this information is prohibited. Emails cannot be guaranteed to be secure or free of errors or viruses. The sender does not accept any liability or responsibility for any interception, corruption, destruction, loss, late arrival or incompleteness of or tampering or interference with any of the information contained in this email or for its incorrect delivery or non-delivery for whatsoever reason or for its effect on any electronic device of the recipient. If verification of this email or any attachment is required, please request a hard copy version.',
        36,
        currentY,
        { 
          width: doc.page.width - 72,
          align: 'left',
          lineGap: 2
        }
      );

    doc.end();
  });
}
