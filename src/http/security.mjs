export function localOnly(req, res, next) {
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
    return res.status(403).json({ error: 'This demo is available on localhost only.' });
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`)
    return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  next();
}
