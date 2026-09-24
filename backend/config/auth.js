function authConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (production && !env.KEYCLOAK_URL) {
    throw new Error('KEYCLOAK_URL est obligatoire en production.');
  }
  const url = (env.KEYCLOAK_URL || 'http://localhost:8080').replace(/\/$/, '');
  const parsed = new URL(url);
  if (production && parsed.protocol !== 'https:') {
    throw new Error('KEYCLOAK_URL doit utiliser HTTPS en production.');
  }
  const realm = env.KEYCLOAK_REALM || 'suivi-cb';
  const issuer = `${url}/realms/${encodeURIComponent(realm)}`;
  // Preserve the public hostname: in start-dev Keycloak derives its expected
  // token issuer from the request host unless KC_HOSTNAME is fixed.
  const accountUrl = (env.KEYCLOAK_ACCOUNT_URL || url).replace(/\/$/, '');
  return {
    public: { url, realm, clientId: env.KEYCLOAK_CLIENT_ID || 'suivi-cb-web' },
    accountUrl,
    issuer,
    jwksUrl: env.KEYCLOAK_JWKS_URL || `${issuer}/protocol/openid-connect/certs`,
    // The web client must be accepted for the banking API and for Keycloak's
    // self-service account API (used only to read the current user's OTP state).
    // `azp` and `app-user` are still enforced by the middleware below.
    audience: [env.KEYCLOAK_AUDIENCE || 'suivi-cb-api', 'account'],
    role: 'app-user',
  };
}

module.exports = { authConfig };
