const cors = require('cors');

function corsOptions(env = process.env) {
  // Production uses the same-origin Nginx proxy; only local Angular needs CORS.
  const allowed = env.NODE_ENV === 'production' ? [] : ['http://localhost:4200', 'http://127.0.0.1:4200'];
  return {
    origin(origin, callback) { callback(null, Boolean(origin && allowed.includes(origin))); },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
  };
}

function configureHttpSecurity(app, env = process.env) {
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    next();
  });
  app.use(cors(corsOptions(env)));
}

function httpErrorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps JSON invalide.' });
  }
  if (error.status === 415) {
    return res.status(415).json({ error: 'Encodage de requête non pris en charge.' });
  }
  // Never log bodies, tokens, SQL errors or stack traces here.
  console.error('[HTTP] Erreur interne', { code: error.code || 'INTERNAL_ERROR' });
  return res.status(500).json({ error: 'Erreur interne du serveur.' });
}

module.exports = { corsOptions, configureHttpSecurity, httpErrorHandler };
