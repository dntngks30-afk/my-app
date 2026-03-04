/**
 * navV2 SSOT — production에서 항상 ON, dev에서만 query로 토글.
 */

export function navV2EnabledFromSearch(search: string): boolean {
  // dev only override: navV2=1 => true, else false
  const qp = new URLSearchParams(search ?? '');
  return qp.get('navV2') === '1';
}

export function isNavV2Enabled(opts?: { search?: string }): boolean {
  if (process.env.NODE_ENV === 'production') return true; // PROD 강제 ON
  return navV2EnabledFromSearch(opts?.search ?? '');
}
