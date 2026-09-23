// Only server-configured keys are trusted; never use a URL from the token.
async function createAuthMiddleware(config, keySet) {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const keys = keySet || createRemoteJWKSet(new URL(config.jwksUrl));
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
    if (!match) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ error: 'Connexion requise.' });
    }
    try {
      const { payload } = await jwtVerify(match[1], keys, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (payload.typ !== 'Bearer' || payload.azp !== config.public.clientId) {
        const error = new Error('Invalid access token');
        error.code = 'INVALID_ACCESS_TOKEN';
        error.claim = payload.typ !== 'Bearer' ? 'typ' : 'azp';
        throw error;
      }
      // The application uses a shared database: access must be explicitly granted.
      if (!payload.realm_access?.roles?.includes(config.role)) {
        return res.status(403).json({ error: 'Accès à cette application non autorisé.' });
      }
      req.auth = payload;
      return next();
    } catch (error) {
      // Log only validation metadata, never tokens, claims values or credentials.
      console.warn('[AUTH] Jeton refusé', {
        code: error.code || 'AUTH_VERIFICATION_FAILED',
        claim: error.claim,
        reason: error.reason,
      });
      res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
      return res.status(401).json({ error: 'Session invalide ou expirée.' });
    }
  };
}

module.exports = { createAuthMiddleware };
