export async function autoCreditIfNeeded() {
  try {
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    const lsRef = localStorage.getItem('lastPayRef') || undefined;
    const ref = urlRef || lsRef;

    if (!ref) return { didRun: false };

    // Prevent double-runs in same session
    if (sessionStorage.getItem(`autoCredit:${ref}`)) return { didRun: false };

    sessionStorage.setItem(`autoCredit:${ref}`, '1');

    // Optional: show a spinner UI can read from this
    localStorage.setItem('autoCreditState', 'running');

    await fetch(`/api/payfast/status?ref=${encodeURIComponent(ref)}`, { credentials: 'include' }).catch(() => {});

    const resp = await fetch(`/api/payfast/credit?ref=${encodeURIComponent(ref)}`, {
      method: 'POST',
      credentials: 'include'
    });

    const json = await resp.json();

    // Clear LS ref if credited or already credited (idempotent)
    if (json?.ok) {
      localStorage.removeItem('lastPayRef');
    }

    // Mark finished and return result
    localStorage.setItem('autoCreditState', 'done');
    return { didRun: true, result: json };
  } catch (e) {
    localStorage.setItem('autoCreditState', 'error');
    return { didRun: true, error: String(e) };
  }
}

