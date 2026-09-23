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
  return {
    public: { url, realm, clientId: env.KEYCLOAK_CLIENT_ID || 'suivi-cb-web' },
    issuer,
    jwksUrl: env.KEYCLOAK_JWKS_URL || `${issuer}/protocol/openid-connect/certs`,
    audience: env.KEYCLOAK_AUDIENCE || 'suivi-cb-api',
    role: 'app-user',
  };
}

module.exports = { authConfig };
