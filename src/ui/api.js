export async function send(type, payload) {
  if (!globalThis.chrome?.runtime?.id) throw new Error('Load this dashboard from the installed extension. See README.md for installation.');
  const result = await chrome.runtime.sendMessage({type, payload});
  if (!result?.ok) throw new Error(result?.error || 'The worker did not respond. Reload the extension and retry.');
  return result.data;
}
export const prettyDate = value => value ? new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}) : '—';
export const prettyTime = value => value ? new Date(value).toLocaleString() : '—';
export const safeLink = url => /^https?:\/\//i.test(url) && URL.canParse(url);
