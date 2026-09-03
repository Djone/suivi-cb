const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isReleaseProcessEnabled(environment = process.env.NODE_ENV) {
  return environment !== 'production';
}

function isLoopbackAddress(address) {
  return LOOPBACK_ADDRESSES.has(String(address || '').toLowerCase());
}

function requireLocalReleaseAccess(req, res, next) {
  const remoteAddress = req.socket?.remoteAddress;
  if (!isLoopbackAddress(remoteAddress)) {
    return res.status(403).json({
      message: "L'assistant de release est accessible uniquement en local.",
    });
  }

  return next();
}

module.exports = {
  isReleaseProcessEnabled,
  isLoopbackAddress,
  requireLocalReleaseAccess,
};
