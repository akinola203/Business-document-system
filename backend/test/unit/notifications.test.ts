import { test } from 'node:test';
import * as assert from 'node:assert';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { NotFoundException } from '@nestjs/common';

test('NotificationsService Unit Tests', async (t) => {
  const notificationsStore: any[] = [];

  const mockPrisma: any = {
    notification: {
      create: async ({ data }: any) => {
        const record = { id: `notif-${notificationsStore.length + 1}`, ...data, isRead: false, createdAt: new Date() };
        notificationsStore.push(record);
        return record;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let list = notificationsStore.filter((n) => n.companyId === where.companyId && n.userId === where.userId);
        if (where.isRead !== undefined) list = list.filter((n) => n.isRead === where.isRead);
        return list.slice(skip, skip + take);
      },
      count: async ({ where }: any) => {
        let list = notificationsStore.filter((n) => n.companyId === where.companyId && n.userId === where.userId);
        if (where.isRead !== undefined) list = list.filter((n) => n.isRead === where.isRead);
        return list.length;
      },
      findFirst: async ({ where }: any) => {
        return notificationsStore.find((n) => n.id === where.id && n.companyId === where.companyId && n.userId === where.userId) || null;
      },
      update: async ({ where, data }: any) => {
        const item = notificationsStore.find((n) => n.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const item of notificationsStore) {
          if (item.companyId === where.companyId && item.userId === where.userId && (where.isRead === undefined || item.isRead === where.isRead)) {
            Object.assign(item, data);
            count++;
          }
        }
        return { count };
      },
    },
  };

  const service = new NotificationsService(mockPrisma);

  await t.test('createNotification stores user notification', async () => {
    const notif = await service.createNotification(
      'comp-1',
      'usr-1',
      'Document Submitted',
      'Invoice INV-2026-000001 submitted for approval.',
      'DOCUMENT_SUBMITTED',
      { documentId: 'doc-1' },
    );

    assert.ok(notif);
    assert.equal(notif.title, 'Document Submitted');
    assert.equal(notif.isRead, false);
    assert.equal(notificationsStore.length, 1);
  });

  await t.test('findAll returns notifications and unread counter', async () => {
    const result = await service.findAll('comp-1', 'usr-1', { page: 1, limit: 10 });
    assert.equal(result.items.length, 1);
    assert.equal(result.unreadCount, 1);
    assert.equal(result.meta.total, 1);
  });

  await t.test('markAsRead marks specified notification as read', async () => {
    const updated = await service.markAsRead('comp-1', 'usr-1', 'notif-1');
    assert.equal(updated.isRead, true);

    const result = await service.findAll('comp-1', 'usr-1', {});
    assert.equal(result.unreadCount, 0);
  });

  await t.test('markAsRead throws NotFoundException if notification does not exist', async () => {
    await assert.rejects(
      async () => service.markAsRead('comp-1', 'usr-1', 'non-existent'),
      (err: any) => err instanceof NotFoundException,
    );
  });

  await t.test('markAllAsRead marks all user notifications as read', async () => {
    await service.createNotification('comp-1', 'usr-1', 'N1', 'M1', 'T1');
    await service.createNotification('comp-1', 'usr-1', 'N2', 'M2', 'T2');

    const result = await service.markAllAsRead('comp-1', 'usr-1');
    assert.equal(result.updatedCount, 2);

    const list = await service.findAll('comp-1', 'usr-1', { unreadOnly: true });
    assert.equal(list.items.length, 0);
  });
});
