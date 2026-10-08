// Link credentials stay in the URL fragment until exchanged for an HttpOnly cookie.
// Clear them before any API request and never save them in browser storage.
export function takeAccessLink(location, history) {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('owner') && !params.has('invite')) return null;
  history.replaceState(null, '', location.pathname + location.search);
  if (params.has('owner')) {
    const token = params.get('owner');
    if (params.has('invite') || params.getAll('owner').length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('专属链接不完整，请重新打开原始链接。');
    return { path: '/api/playtest/owner', data: { token } };
  }
  const code = params.get('invite');
  if (params.getAll('invite').length !== 1 || !code?.trim() || code.length > 80) throw new Error('分享链接不完整，请重新打开原始链接。');
  return { path: '/api/playtest/login', data: { code: code.trim() } };
}
