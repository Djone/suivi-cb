const { isLoopbackAddress } = require('./release-access.middleware');

function isDocumentationEnabled(env = process.env) {
  return (!env.NODE_ENV || env.NODE_ENV === 'development') && env.DOCUMENTATION_DISABLED !== 'true';
}

function requireLocalDocumentationAccess(req, res, next) {
  if (!isDocumentationEnabled()) return res.status(404).json({ error: 'Ressource introuvable.' });
  // Use the socket address, never a spoofable X-Forwarded-For header.
  if (!isLoopbackAddress(req.socket?.remoteAddress)) {
    return res.status(403).json({ error: 'La documentation du dépôt est accessible uniquement sur le poste de développement.' });
  }
  return next();
}

module.exports = { isDocumentationEnabled, requireLocalDocumentationAccess };
