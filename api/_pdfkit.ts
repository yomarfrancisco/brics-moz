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

    // --- Header: Logo top-left (doubled size)
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
        // Double the logo size (was height: 24, now width: 116 or height: 48)
        doc.image(logoPath, 36, currentY, { width: 116 });
        console.log('[pdfkit] Logo loaded from:', logoPath);
        // Calculate actual logo height after rendering to push content down properly
        // For a doubled logo, estimate ~48pt height, but add extra buffer to prevent overlap
      } else {
        console.warn('[pdfkit] Logo not found at either path');
      }
    } catch (e) {
      console.warn('[pdfkit] Failed to load logo:', e);
    }

    // Horizontal rule under logo (solid black, full width)
    // Logo is now width: 116 (doubled from ~58), estimate height at ~48 for spacing calc
    // Add substantial extra spacing to prevent overlap: 48pt logo + 25pt spacing + 50pt buffer
    currentY = 36 + 48 + 25 + 50; // estimated logo height (doubled) + generous spacing + very large buffer to prevent overlap
    doc
      .moveTo(36, currentY)
      .lineTo(doc.page.width - 36, currentY)
      .lineWidth(0.5)
      .strokeColor('#000000') // Changed from grey to black
      .stroke();

    // Title + intro (additional spacing below rule to prevent overlap)
    currentY += 40; // Substantially increased spacing to ensure title doesn't overlap with logo
    doc
      .font(BOLD)
      .fontSize(TITLE_SIZE)
      .fillColor(BLACK)
      .text('Notification of Payment', 36, currentY); // Capital P in Payment

    // Intro paragraph (doubled spacing after title: was TITLE_SIZE + 8, now 2×)
    currentY += (TITLE_SIZE + 8) * 2; // Doubled spacing
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

    // Two-column details table (one full row of extra space after intro)
    currentY = doc.y + 12 + 12; // Added one full row (12pt) of extra space
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
          .font(REGULAR) // Changed from SEMI_BOLD to REGULAR - table values should not be bold
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

    // Anti-phishing note (one full row of extra space above: was 14pt, now add 12pt more)
    currentY += 14 + 12; // Added one full row (12pt) of extra space
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

    // Horizontal black rule after anti-phishing paragraph (full width, then one row space below)
    // Calculate position after the anti-phishing text
    currentY = doc.y + 12; // One row of space after text, then draw rule
    doc
      .moveTo(36, currentY)
      .lineTo(doc.page.width - 36, currentY)
      .lineWidth(0.5)
      .strokeColor('#000000') // Black horizontal rule
      .stroke();

    // One extra row of space below the rule before continuing prose
    currentY += 12; // One full row of space

    // Legal + footer prose (continues after the black rule and spacing)
    
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

    // "BRICS Limited email" heading (bold, 10-12pt spacing) - fixed typo: was "Nedbank"
    currentY = doc.y + 12;
    doc
      .font(BOLD)
      .fontSize(BODY_SIZE)
      .fillColor(BLACK)
      .text('BRICS Limited email', 36, currentY);

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
