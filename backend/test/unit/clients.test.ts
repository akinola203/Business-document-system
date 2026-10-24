import { test } from 'node:test';
import * as assert from 'node:assert';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../src/modules/clients/clients.service';
import { ClientStatus, ClientType, AddressType } from '@prisma/client';

test('ClientsService Unit Tests', async (t) => {
  let clientsDb: any[] = [];
  let addressesDb: any[] = [];
  let auditLogs: any[] = [];

  const mockPrisma: any = {
    client: {
      count: async ({ where }: any) => {
        return clientsDb.filter((c) => {
          if (where.companyId && c.companyId !== where.companyId) return false;
          if (where.status && c.status !== where.status) return false;
          return true;
        }).length;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let list = clientsDb.filter((c) => c.companyId === where.companyId);
        if (where.status) list = list.filter((c) => c.status === where.status);
        if (where.OR) {
          const search = where.OR[0].name.contains.toLowerCase();
          list = list.filter((c) =>
            c.name.toLowerCase().includes(search) ||
            (c.companyName && c.companyName.toLowerCase().includes(search)) ||
            c.clientNumber.toLowerCase().includes(search),
          );
        }
        return list.slice(skip, skip + take).map((c) => ({
          ...c,
          addresses: addressesDb.filter((a) => a.clientId === c.id && a.isDefault),
          _count: { documents: 0, addresses: addressesDb.filter((a) => a.clientId === c.id).length },
        }));
      },
      findFirst: async ({ where }: any) => {
        const client = clientsDb.find((c) => c.id === where.id && c.companyId === where.companyId);
        if (!client) return null;
        return {
          ...client,
          addresses: addressesDb.filter((a) => a.clientId === client.id),
          _count: { documents: 0 },
        };
      },
      findUnique: async ({ where }: any) => {
        if (where.companyId_clientNumber) {
          return clientsDb.find(
            (c) =>
              c.companyId === where.companyId_clientNumber.companyId &&
              c.clientNumber === where.companyId_clientNumber.clientNumber,
          );
        }
        return clientsDb.find((c) => c.id === where.id);
      },
      create: async ({ data }: any) => {
        const id = `client-${clientsDb.length + 1}`;
        const item = {
          id,
          status: ClientStatus.ACTIVE,
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        clientsDb.push(item);
        if (data.addresses?.create) {
          data.addresses.create.forEach((addr: any) => {
            addressesDb.push({ id: `addr-${addressesDb.length + 1}`, clientId: id, ...addr });
          });
        }
        return { ...item, addresses: addressesDb.filter((a) => a.clientId === id) };
      },
      update: async ({ where, data }: any) => {
        const idx = clientsDb.findIndex((c) => c.id === where.id);
        clientsDb[idx] = { ...clientsDb[idx], ...data };
        return { ...clientsDb[idx], addresses: addressesDb.filter((a) => a.clientId === where.id) };
      },
    },
    clientAddress: {
      findFirst: async ({ where }: any) => {
        return addressesDb.find((a) => a.id === where.id && a.clientId === where.clientId);
      },
      create: async ({ data }: any) => {
        const item = { id: `addr-${addressesDb.length + 1}`, createdAt: new Date(), ...data };
        addressesDb.push(item);
        return item;
      },
      updateMany: async ({ where, data }: any) => {
        addressesDb.forEach((a) => {
          if (a.clientId === where.clientId && a.type === where.type) {
            Object.assign(a, data);
          }
        });
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const idx = addressesDb.findIndex((a) => a.id === where.id);
        addressesDb[idx] = { ...addressesDb[idx], ...data };
        return addressesDb[idx];
      },
      delete: async ({ where }: any) => {
        const idx = addressesDb.findIndex((a) => a.id === where.id);
        addressesDb.splice(idx, 1);
        return { id: where.id };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: 'audit-1', ...data };
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const service = new ClientsService(mockPrisma);

  await t.test('generateNextClientNumber formats sequential client numbers correctly', async () => {
    clientsDb = [];
    const num1 = await service.generateNextClientNumber('comp-1');
    assert.equal(num1, 'CLI-00001');

    clientsDb.push({ id: 'client-1', companyId: 'comp-1', clientNumber: 'CLI-00001' });
    const num2 = await service.generateNextClientNumber('comp-1');
    assert.equal(num2, 'CLI-00002');
  });

  await t.test('create initializes client with addresses and rejects duplicate clientNumber', async () => {
    clientsDb = [];
    addressesDb = [];
    auditLogs = [];

    const client = await service.create(
      'comp-1',
      {
        clientNumber: 'CLI-00100',
        type: ClientType.COMPANY,
        name: 'Dangote Cement Distribution Hub',
        companyName: 'Dangote Industries Limited',
        email: 'logistics@dangote.com',
        phone: '+234 802 000 1111',
        addresses: [
          {
            type: AddressType.BILLING,
            addressLine1: 'Plot 45 Industrial Estate',
            city: 'Ota',
            state: 'Ogun State',
            isDefault: true,
          },
        ],
      },
      'usr-1',
    );

    assert.equal(client.name, 'Dangote Cement Distribution Hub');
    assert.equal(client.clientNumber, 'CLI-00100');
    assert.equal(client.addresses.length, 1);
    assert.equal(client.addresses[0].city, 'Ota');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'CLIENT_CREATED');

    await assert.rejects(
      async () => {
        await service.create('comp-1', { clientNumber: 'CLI-00100', name: 'Duplicate Client' }, 'usr-1');
      },
      ConflictException,
    );
  });

  await t.test('findAll filters by search and status', async () => {
    clientsDb.push({
      id: 'client-2',
      companyId: 'comp-1',
      clientNumber: 'CLI-00101',
      name: 'Prime Packaging Ltd',
      companyName: 'Prime Packaging West Africa',
      status: ClientStatus.ACTIVE,
    });

    const results = await service.findAll('comp-1', { search: 'Prime' });
    assert.equal(results.items.length, 1);
    assert.equal(results.items[0].name, 'Prime Packaging Ltd');
  });

  await t.test('updateStatus toggles active and inactive states', async () => {
    const updated = await service.updateStatus('comp-1', 'client-2', ClientStatus.INACTIVE, 'usr-1');
    assert.equal(updated.status, ClientStatus.INACTIVE);
  });

  await t.test('addAddress creates and sets default address, resetting previous defaults', async () => {
    const newAddr = await service.addAddress(
      'comp-1',
      'client-1',
      {
        type: AddressType.BILLING,
        addressLine1: 'New Industrial Hub Annex',
        city: 'Agbara',
        state: 'Ogun State',
        isDefault: true,
      },
      'usr-1',
    );

    assert.equal(newAddr.city, 'Agbara');
    assert.equal(newAddr.isDefault, true);

    // Verify first address is no longer default
    const firstAddr = addressesDb.find((a) => a.id === 'addr-1');
    assert.equal(firstAddr?.isDefault, false);
  });

  await t.test('deleteAddress removes specified address', async () => {
    const result = await service.deleteAddress('comp-1', 'client-1', 'addr-2', 'usr-1');
    assert.equal(result.message, 'Address successfully deleted.');
    assert.equal(addressesDb.some((a) => a.id === 'addr-2'), false);
  });
});
