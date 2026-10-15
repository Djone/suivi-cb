// Mounted after requireAuth. Only credentials returned for the bearer owner
// are considered; no user ID or credential ID is accepted from the browser.
function createDisableOtpHandler(config, request = fetch) {
  return async (req, res) => {
    const base = `${config.accountUrl}/realms/${encodeURIComponent(config.public.realm)}/account/credentials`;
    const headers = { Accept: 'application/json', Authorization: req.get('Authorization') };
    const call = (url, method = 'GET') => request(url, {
      method, headers, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const readOtp = async () => {
      const response = await call(`${base}?user-credentials=true`);
      if (!response.ok) throw new Error('KEYCLOAK_ACCOUNT_UNAVAILABLE');
      const groups = await response.json();
      if (!Array.isArray(groups)) throw new Error('KEYCLOAK_ACCOUNT_INVALID_RESPONSE');
      return groups.filter(group => group.type === 'otp').flatMap(group => {
        if (!Array.isArray(group.userCredentialMetadatas)) throw new Error('KEYCLOAK_ACCOUNT_INVALID_RESPONSE');
        return group.userCredentialMetadatas.map(metadata => {
          const credential = metadata.credential;
          if (credential?.type !== 'otp' || typeof credential.id !== 'string' || !credential.id) {
            throw new Error('KEYCLOAK_ACCOUNT_INVALID_RESPONSE');
          }
          return credential.id;
        });
      });
    };
    res.set('Cache-Control', 'no-store');
    try {
      const ids = [...new Set(await readOtp())];
      if (ids.length && req.auth && req.auth.acr == null) {
        return res.status(403).json({ error: 'OTP_ACR_MISSING' });
      }
      for (const id of ids) {
        const response = await call(`${base}/${encodeURIComponent(id)}`, 'DELETE');
        if (!response.ok && response.status !== 404) {
          return res.status(response.status === 403 ? 403 : 502).json({ error: 'OTP_DELETE_REFUSED' });
        }
      }
      if ((await readOtp()).length) return res.status(409).json({ error: 'OTP_STILL_CONFIGURED' });
      return res.status(204).end();
    } catch {
      return res.status(502).json({ error: 'OTP_DELETE_UNAVAILABLE' });
    }
  };
}

module.exports = { createDisableOtpHandler };
