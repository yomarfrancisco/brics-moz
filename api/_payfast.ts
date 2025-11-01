import crypto from 'crypto';

export function getPayFastBase(mode: string): string {
  return mode === 'sandbox'
    ? 'https://sandbox.payfast.co.za'
    : 'https://www.payfast.co.za';
}

/**
 * Build a URLSearchParams with PHP urlencode semantics for spaces (+),
 * excluding empty values, and use its .toString() for signature input.
 * Then do MD5 over that exact string.
 */
export function buildParamsAndSignature(
  raw: Record<string, string | number | undefined | null>,
  passphrase?: string
): { params: URLSearchParams; signature: string } {
  // Build params exactly as we will send them.
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (v === '' || v === null || v === undefined) continue;
    // URLSearchParams encodes like application/x-www-form-urlencoded (spaces -> '+')
    params.append(k, String(v));
  }
  if (passphrase) {
    params.append('passphrase', passphrase);
  }
  // The string we sign MUST equal what PayFast reconstructs.
  const toSign = params.toString(); // e.g. key=a+b&return_url=https%3A%2F%2F...
  const signature = crypto.createHash('md5').update(toSign).digest('hex');
  // Remove passphrase from sent params (it must not be sent).
  if (passphrase) {
    // Rebuild without passphrase to avoid mutation surprises.
    const noPass = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (k !== 'passphrase') noPass.append(k, v);
    }
    return { params: noPass, signature };
  }
  return { params, signature };
}
