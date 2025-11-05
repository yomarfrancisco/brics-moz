import { promises as fs } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';

export const runtime = 'nodejs';

export type PopData = {
  reference: string;
  // ISO strings
  paidAtIso: string;        // e.g., '2025-11-05T11:33:14.813Z'
  paidAtLocal: string;      // preformatted local time (e.g., '11:33:14 Local')
  // Beneficiary (destination)
  recipient: string;        // account holder name
  amount: string;           // '0.01 USDT' or 'R9536.25' (already formatted)
  note?: string;            // memo if provided
  bank: string;
  accountNumber: string;    // full, not masked
  country: string;          // 'South Africa' or 'ZA'
  // Payer
  payerHandle: string;      // e.g., '@brics_abc123'
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  headerRow: {
    marginBottom: 12,
  },
  logo: {
    width: 70,
    height: 'auto',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
    marginBottom: 18,
  },
  h1: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6,
    color: '#111827',
  },
  intro: {
    fontSize: 11,
    color: '#111827',
    lineHeight: 1.4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 4,
    color: '#111827',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 6,
  },
  label: {
    fontSize: 10.5,
    color: '#6B7280',
    width: 180,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 11.5,
    color: '#111827',
    flexGrow: 1,
    textAlign: 'right',
    fontFamily: 'Courier',
  },
  legal: {
    fontSize: 9.5,
    color: '#6B7280',
    lineHeight: 1.35,
    marginTop: 18,
  },
});

// Legal disclaimer text from POP2
const LEGAL_TEXT = `BRICS and its partner banks will never send you an e-mail link to verify payments, always go to https://www.brics.ninja/ and log in to verify a payment.

This notification of payment is sent to you by BRICS is a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024). For any enquiries, please contact BRICS Contact Centre on "+2760 867 8513" or via email at "info@brics.ninja". Please contact the payer for enquiries regarding the contents of this notification.

BRICS will not be held responsible for the accuracy of the information on this notification and we accept no liability whatsoever arising from the transmission and use of the information. Payments may take up to three business days. Please check your account to verify the existence of the funds.

Note: We as a bank will never send you an e-mail requesting you to enter your personal details or private identification and authentication details.

Nedbank Limited email

The information contained in this email and any attachments is private and protected by law. If you are not the intended recipient, you are requested to delete this entire communication immediately and are notified that any disclosure, copying or distribution of or taking any action based on this information is prohibited. Emails cannot be guaranteed to be secure or free of errors or viruses. The sender does not accept any liability or responsibility for any interception, corruption, destruction, loss, late arrival or incompleteness of or tampering or interference with any of the information contained in this email or for its incorrect delivery or non-delivery for whatsoever reason or for its effect on any electronic device of the recipient. If verification of this email or any attachment is required, please request a hard copy version.`;

function PopDocument({ data }: { data: PopData & { logoData: Buffer } }) {
  // Format date from ISO string (e.g., '2025-11-05T11:33:14.813Z' -> '01/11/2025')
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo and Divider */}
        <View style={styles.headerRow}>
          {data.logoData && data.logoData.length > 0 && (
            <Image 
              src={{ data: data.logoData, format: 'png' }} 
              style={styles.logo} 
            />
          )}
          <View style={styles.divider} />
        </View>

        {/* Heading */}
        <Text style={styles.h1}>Notification of Payment</Text>

        {/* Intro */}
        <Text style={styles.intro}>
          BRICS, a service provider of NASASA, an authorised Financial Services Provider (FSP 52815) and Co-operative bank (Certificate no. CFI0024), confirm that the following payment has been made:
        </Text>

        {/* Payment Details */}
        <View style={styles.row}>
          <Text style={styles.label}>Date of Payment</Text>
          <Text style={styles.value}>{formatDate(data.paidAtIso)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Time of Payment</Text>
          <Text style={styles.value}>{data.paidAtLocal}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Reference Number</Text>
          <Text style={styles.value}>{data.reference}</Text>
        </View>

        {/* Beneficiary details */}
        <Text style={styles.sectionTitle}>Beneficiary details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Recipient</Text>
          <Text style={styles.value}>{data.recipient}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.value}>{data.amount}</Text>
        </View>
        {data.note && (
          <View style={styles.row}>
            <Text style={styles.label}>Note</Text>
            <Text style={styles.value}>{data.note}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Bank</Text>
          <Text style={styles.value}>{data.bank}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Account Number</Text>
          <Text style={styles.value}>{data.accountNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Country</Text>
          <Text style={styles.value}>{data.country}</Text>
        </View>

        {/* Payer details */}
        <Text style={styles.sectionTitle}>Payer details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Paid from Account Holder</Text>
          <Text style={styles.value}>{data.payerHandle}</Text>
        </View>

        {/* Legal/Disclaimer */}
        <Text style={styles.legal}>{LEGAL_TEXT}</Text>
      </Page>
    </Document>
  );
}

/**
 * Render withdrawal Proof-of-Payment PDF in POP2 style
 * @param data PopData with all required fields
 * @returns PDF bytes as Uint8Array
 */
export async function renderWithdrawalPOP(data: PopData): Promise<Uint8Array> {
  // Load logo image
  const logoPath = path.resolve(process.cwd(), 'src/assets/doll regulator_small.png');
  let logoData: Buffer;
  try {
    logoData = await fs.readFile(logoPath);
  } catch (e) {
    console.error('[pdf] Failed to load logo:', e);
    // Fallback: create a small placeholder if logo fails
    logoData = Buffer.alloc(0);
  }

  // Add logo data to PopData
  const dataWithLogo = { ...data, logoData };

  // Render PDF using @react-pdf/renderer
  const doc = <PopDocument data={dataWithLogo} />;
  const asBuffer = await pdf(doc).toBuffer();
  
  return new Uint8Array(asBuffer);
}

