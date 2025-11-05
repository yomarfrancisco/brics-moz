import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

export type PopData = {
  date: string;              // e.g., '01/11/2025'
  timeLocal: string;         // e.g., '11:33:14 Local'
  reference: string;         // withdrawal ID
  recipient: string;         // account holder name
  amount: string;            // e.g., '0.010000 USDT' or 'R9536.25'
  note?: string;             // optional memo
  bank: string;
  accountNumber: string;     // full account number
  country: string;           // e.g., 'South Africa'
  payerHandle: string;       // e.g., '@brics_abc123'
};

function logoBuffer(): Buffer | null {
  try {
    // Try public path first (serverless-friendly)
    const publicPath = path.resolve(process.cwd(), 'public/img/dall-regulator-small.png');
    const srcPath = path.resolve(process.cwd(), 'src/assets/doll regulator_small.png');
    
    if (fs.existsSync(publicPath)) {
      return fs.readFileSync(publicPath);
    } else if (fs.existsSync(srcPath)) {
      return fs.readFileSync(srcPath);
    }
    console.warn('[pdfkit] Logo not found at either path');
    return null;
  } catch (e) {
    console.warn('[pdfkit] Failed to load logo:', e);
    return null;
  }
}

export async function renderWithdrawalPOP(data: PopData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 36, left: 36, right: 36, bottom: 36 } // 0.5" margins per spec
    });

    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Typography constants
    const MARGIN = 36;                // 0.5" margins
    const LINE_GAP = 6;
    const TABLE_ROW_GAP = 10;
    const LABEL_GREY = '#6B7280';     // tailwind gray-500
    const HR_GREY = '#D1D5DB';        // gray-300
    const BODY_SIZE = 10;
    const TITLE_SIZE = 14;            // Per original spec (not 12)
    const SECTION_HEADING_SIZE = 11;  // Per original spec

    // --- PAGE 1 ---

    // Logo (top-left, small, 24pt height)
    const logoBuf = logoBuffer();
    if (logoBuf) {
      doc.image(logoBuf, MARGIN, MARGIN, { height: 24 });
      console.log('[pdfkit] Logo loaded successfully');
    } else {
      console.warn('[pdfkit] Logo not available, continuing without logo');
    }

    // Vertical space below logo
    doc.y = MARGIN + 24 + 10; // logo height + spacing

    // Thin horizontal rule under logo
    const hrY = doc.y - 6;
    doc
      .moveTo(MARGIN, hrY)
      .lineTo(doc.page.width - MARGIN, hrY)
      .lineWidth(0.7)
      .strokeColor(HR_GREY)
      .stroke();

    // Reset Y position for moveDown() to work correctly
    doc.y = hrY;

    // Title: "Notification of Payment" (capital P)
    doc.moveDown(1.2);
    doc
      .font('Helvetica-Bold')
      .fontSize(TITLE_SIZE)
      .fillColor('black')
      .text('Notification of Payment', { align: 'left' });

    // Intro paragraph (BRICS as a service provider)
    doc.moveDown(0.6);
    doc
      .font('Helvetica')
      .fontSize(BODY_SIZE)
      .fillColor('#111111')
      .text(
        'BRICS, a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024), confirm that the following payment has been made:',
        { 
          width: doc.page.width - MARGIN * 2,
          align: 'left',
          lineGap: 2
        }
      );

    // Table (two columns; labels left/grey/uppercase, values right/bold; no borders)
    doc.moveDown(1);

    const row = (label: string, value: string) => {
      const startY = doc.y + 3;

      // Left label (uppercase, grey)
      doc
        .fillColor(LABEL_GREY)
        .font('Helvetica')
        .fontSize(BODY_SIZE)
        .text(label.toUpperCase(), MARGIN, startY, { width: 200 });

      // Right value (bold, black, right-aligned)
      doc
        .fillColor('black')
        .font('Helvetica-Bold')
        .fontSize(BODY_SIZE)
        .text(value, MARGIN + 200, startY, {
          width: doc.page.width - MARGIN * 2 - 200,
          align: 'right'
        });

      // No row dividers (spacing-based, per POP2 spec)
      doc.y = startY + TABLE_ROW_GAP;
    };

    // Payment Details Group
    row('Date of Payment', data.date);
    row('Time of Payment', data.timeLocal);
    row('Reference Number', data.reference);

    // Beneficiary details section
    doc.moveDown(0.6);
    doc
      .font('Helvetica-Bold')
      .fontSize(SECTION_HEADING_SIZE)
      .fillColor('black')
      .text('Beneficiary details', { align: 'left' });

    doc.moveDown(0.4);

    row('Recipient', data.recipient);
    row('Amount', data.amount);
    if (data.note) {
      row('Note', data.note);
    }
    row('Bank', data.bank);
    row('Account Number', data.accountNumber);
    row('Country', data.country);

    // Payer details section
    doc.moveDown(0.6);
    doc
      .font('Helvetica-Bold')
      .fontSize(SECTION_HEADING_SIZE)
      .fillColor('black')
      .text('Payer details', { align: 'left' });

    doc.moveDown(0.4);

    row('Paid from Account Holder', data.payerHandle);

    // Anti-phishing note (page 1, before break)
    doc.moveDown(1.0);
    doc
      .font('Helvetica')
      .fontSize(BODY_SIZE)
      .fillColor(LABEL_GREY)
      .text(
        'BRICS and its partner banks will never send you an e-mail link to verify payments, always go to https://www.brics.ninja/ and log in to verify a payment.',
        { 
          width: doc.page.width - MARGIN * 2,
          align: 'left',
          lineGap: 2
        }
      );

    // Horizontal rule then page break
    doc.moveDown(0.6);
    const hr2 = doc.y;
    doc
      .moveTo(MARGIN, hr2)
      .lineTo(doc.page.width - MARGIN, hr2)
      .lineWidth(0.7)
      .strokeColor(HR_GREY)
      .stroke();

    doc.addPage();

    // --- PAGE 2 ---

    // Page 2 header: "Page 2 of 2" centered
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(LABEL_GREY)
      .text('Page 2 of 2', MARGIN, MARGIN, { 
        width: doc.page.width - MARGIN * 2,
        align: 'center' 
      });

    doc.y = MARGIN + 12;

    // Legal paragraphs in order

    // Paragraph 1: BRICS notification with contact info
    doc.moveDown(1);
    doc
      .fillColor('black')
      .font('Helvetica')
      .fontSize(BODY_SIZE)
      .text(
        'This notification of payment is sent to you by BRICS, a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024). Enquiries regarding this payment notification should be directed to the BRICS Contact Centre on +2760 867 8513. Alternatively via email on info@brics.ninja. Please contact the payer for enquiries regarding the contents of this notification.',
        { 
          width: doc.page.width - MARGIN * 2,
          align: 'left',
          lineGap: 2
        }
      );

    // Paragraph 2: Liability disclaimer
    doc.moveDown(0.8);
    doc.text(
      'BRICS will not be held responsible for the accuracy of the information on this notification and we accept no liability whatsoever arising from the transmission and use of the information. Payments may take up to three business days. Please check your account to verify the existence of the funds.',
      { 
        width: doc.page.width - MARGIN * 2,
        align: 'left',
        lineGap: 2
      }
    );

    // Paragraph 3: Bank anti-phishing note
    doc.moveDown(0.8);
    doc.text(
      'Note: We as a bank will never send you an e-mail requesting you to enter your personal details or private identification and authentication details.',
      { 
        width: doc.page.width - MARGIN * 2,
        align: 'left',
        lineGap: 2
      }
    );

    // Paragraph 4: "Nedbank Limited email" heading (bold)
    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(BODY_SIZE)
      .text('Nedbank Limited email', { align: 'left' });

    // Paragraph 5: Confidentiality paragraph
    doc.moveDown(0.4);
    doc
      .font('Helvetica')
      .text(
        'This email and any accompanying attachments may contain confidential and proprietary information. This information is private and protected by law and, accordingly, if you are not the intended recipient, you are requested to delete this entire communication immediately and are notified that any disclosure, copying or distribution of or taking any action based on this information is prohibited. Emails cannot be guaranteed to be secure or free of errors or viruses. The sender does not accept any liability or responsibility for any interception, corruption, destruction, loss, late arrival or incompleteness of or tampering or interference with any of the information contained in this email or for its incorrect delivery or non-delivery for whatsoever reason or for its effect on any electronic device of the recipient. If verification of this email or any attachment is required, please request a hard copy version.',
        { 
          width: doc.page.width - MARGIN * 2,
          align: 'left',
          lineGap: 2
        }
      );

    // Optional security code at bottom
    doc.y = doc.page.height - MARGIN - 12;
    const sec = (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).toUpperCase();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(LABEL_GREY)
      .text(`Security Code: ${sec}`, MARGIN, doc.y, { align: 'left' });

    doc.end();
  });
}
