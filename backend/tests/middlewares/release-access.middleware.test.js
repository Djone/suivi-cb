const {
  isReleaseProcessEnabled,
  isLoopbackAddress,
  requireLocalReleaseAccess,
} = require('../../middlewares/release-access.middleware');

describe('Release access middleware', () => {
  it('desactive le processus de release en production', () => {
    expect(isReleaseProcessEnabled('production')).toBe(false);
    expect(isReleaseProcessEnabled('development')).toBe(true);
    expect(isReleaseProcessEnabled('test')).toBe(true);
  });

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])(
    'accepte une adresse locale (%s)',
    (address) => {
      expect(isLoopbackAddress(address)).toBe(true);
    },
  );

  it('refuse une adresse distante', () => {
    const req = { socket: { remoteAddress: '192.168.1.50' } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    requireLocalReleaseAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message: "L'assistant de release est accessible uniquement en local.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('laisse passer une requete locale', () => {
    const req = { socket: { remoteAddress: '::1' } };
    const res = { status: jest.fn() };
    const next = jest.fn();

    requireLocalReleaseAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
