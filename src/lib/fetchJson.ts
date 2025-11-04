/**
 * Safe JSON fetch helper that handles non-JSON error responses
 * Prevents "Unexpected token 'A'" errors when server returns plain text
 */

export async function fetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  
  let body: any;
  try {
    if (isJson) {
      body = await res.json();
    } else {
      const text = await res.text();
      // Try to parse as JSON if it looks like JSON
      try {
        body = JSON.parse(text);
      } catch {
        // Plain text error response
        body = { ok: false, error: text || `HTTP ${res.status}` };
      }
    }
  } catch (e: any) {
    // Fallback if parsing fails
    body = { ok: false, error: `Failed to parse response: ${e.message}` };
  }
  
  if (!res.ok) {
    const error = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(error);
  }
  
  return body;
}

