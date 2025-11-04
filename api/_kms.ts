/**
 * KMS decryption helper for environment variables
 * Supports GCP KMS and AWS KMS (decrypt ciphertextEnvName)
 */

export const runtime = 'nodejs';

async function decryptGCPKMS(ciphertext: string, keyResource: string): Promise<string> {
  // For MVP, we'll use a simple approach
  // In production, use @google-cloud/kms
  // For now, if ciphertext is base64 encoded, decode it
  // This is a placeholder - real implementation should use GCP KMS client
  try {
    // Placeholder: return as-is if not encrypted, or decode base64
    if (ciphertext.startsWith('base64:')) {
      return Buffer.from(ciphertext.slice(7), 'base64').toString('utf-8');
    }
    // If it's already a plaintext secret (for dev), return it
    // WARNING: In production, never store plaintext secrets
    return ciphertext;
  } catch (e) {
    throw new Error(`GCP KMS decrypt failed: ${e}`);
  }
}

async function decryptAWSKMS(ciphertext: string, keyId: string): Promise<string> {
  // Placeholder for AWS KMS
  // In production, use @aws-sdk/client-kms
  try {
    if (ciphertext.startsWith('base64:')) {
      return Buffer.from(ciphertext.slice(7), 'base64').toString('utf-8');
    }
    return ciphertext;
  } catch (e) {
    throw new Error(`AWS KMS decrypt failed: ${e}`);
  }
}

/**
 * Decrypt an environment variable using KMS
 * @param ciphertextEnvName - Name of env var containing ciphertext
 * @returns Decrypted plaintext
 */
export async function decryptEnv(ciphertextEnvName: string): Promise<string> {
  const ciphertext = process.env[ciphertextEnvName];
  if (!ciphertext) {
    throw new Error(`Environment variable ${ciphertextEnvName} not set`);
  }

  const kmsKeyResource = process.env.KMS_KEY_RESOURCE;
  if (!kmsKeyResource) {
    // Fallback: assume plaintext for dev (NOT SECURE FOR PROD)
    console.warn(`[KMS] KMS_KEY_RESOURCE not set, using plaintext (DEV ONLY)`);
    return ciphertext;
  }

  // Determine KMS provider from key resource format
  if (kmsKeyResource.startsWith('projects/')) {
    // GCP KMS format: projects/PROJECT/locations/LOC/keyRings/RING/cryptoKeys/KEY
    return decryptGCPKMS(ciphertext, kmsKeyResource);
  } else if (kmsKeyResource.startsWith('arn:aws')) {
    // AWS KMS format: arn:aws:kms:region:account:key/key-id
    return decryptAWSKMS(ciphertext, kmsKeyResource);
  } else {
    throw new Error(`Unknown KMS key resource format: ${kmsKeyResource}`);
  }
}

