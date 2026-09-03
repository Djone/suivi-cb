import { NotificationCenterService } from './notification-center.service';

describe('NotificationCenterService', () => {
  const storageKey = 'suivi-cb-read-notifications';
  const notification = {
    id: '1:warn:test',
    severity: 'warn' as const,
    text: 'Notification de test',
    accountId: 1,
    accountName: 'Compte courant',
  };

  beforeEach(() => localStorage.removeItem(storageKey));
  afterEach(() => localStorage.removeItem(storageKey));

  it('retire le point non lu apres lecture', () => {
    const service = new NotificationCenterService();
    let unread = false;
    service.unread$.subscribe((value) => (unread = value));

    service.setNotifications([notification]);
    expect(unread).toBeTrue();

    service.markAllAsRead();
    expect(unread).toBeFalse();
  });

  it('conserve la lecture apres recreation du service', () => {
    const firstService = new NotificationCenterService();
    firstService.setNotifications([notification]);
    firstService.markAllAsRead();

    const nextService = new NotificationCenterService();
    let unread = true;
    nextService.unread$.subscribe((value) => (unread = value));
    nextService.setNotifications([notification]);

    expect(unread).toBeFalse();
  });

  it('reinitialise les lectures enregistrees pour un mois precedent', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ period: '2000-01', ids: [notification.id] }),
    );
    const service = new NotificationCenterService();
    let unread = false;
    service.unread$.subscribe((value) => (unread = value));

    service.setNotifications([notification]);

    expect(unread).toBeTrue();
  });
});
