import { test } from 'node:test';
import * as assert from 'node:assert';
import { TemplatesService } from '../../src/modules/templates/templates.service';
import {
  renderInvoiceHtml,
  renderWaybillHtml,
  renderLetterHtml,
} from '../../src/modules/templates/renderers';
import { DocumentType } from '@prisma/client';

test('Templates & HTML Renderers Unit Tests', async (t) => {
  const templatesStore: any[] = [];
  const versionsStore: any[] = [];
  const auditLogsStore: any[] = [];

  const mockPrisma: any = {
    $transaction: async (cb: any) => cb(mockPrisma),
    template: {
      findUnique: async ({ where }: any) => {
        if (where.companyId_code) {
          return templatesStore.find(
            (tmpl) => tmpl.companyId === where.companyId_code.companyId && tmpl.code === where.companyId_code.code,
          ) || null;
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return templatesStore.filter(
          (t) => t.companyId === where.companyId && (!where.documentType || t.documentType === where.documentType),
        );
      },
      findFirst: async ({ where }: any) => {
        const found = templatesStore.find(
          (t) => t.id === where.id && (!where.companyId || t.companyId === where.companyId),
        );
        if (!found) return null;
        const vers = versionsStore
          .filter((v) => v.templateId === found.id)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return { ...found, versions: vers };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const tmpl of templatesStore) {
          if (
            tmpl.companyId === where.companyId &&
            tmpl.documentType === where.documentType &&
            (where.isDefault === undefined || tmpl.isDefault === where.isDefault) &&
            (!where.id?.not || tmpl.id !== where.id.not)
          ) {
            Object.assign(tmpl, data);
            count++;
          }
        }
        return { count };
      },
      create: async ({ data }: any) => {
        const templateId = `tmpl-${templatesStore.length + 1}`;
        const template = {
          id: templateId,
          companyId: data.companyId,
          documentType: data.documentType,
          name: data.name,
          code: data.code,
          isDefault: data.isDefault ?? false,
          isActive: data.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        templatesStore.push(template);

        if (data.versions?.create) {
          const version = {
            id: `ver-${versionsStore.length + 1}`,
            templateId,
            ...data.versions.create,
            createdAt: new Date(),
          };
          versionsStore.push(version);
        }

        return {
          ...template,
          versions: versionsStore.filter((v) => v.templateId === templateId),
        };
      },
      update: async ({ where, data }: any) => {
        const tmpl = templatesStore.find((t) => t.id === where.id);
        if (!tmpl) return null;
        if (data.name !== undefined) tmpl.name = data.name;
        if (data.isDefault !== undefined) tmpl.isDefault = data.isDefault;
        if (data.isActive !== undefined) tmpl.isActive = data.isActive;

        if (data.versions?.create) {
          const version = {
            id: `ver-${versionsStore.length + 1}`,
            templateId: tmpl.id,
            ...data.versions.create,
            createdAt: new Date(),
          };
          versionsStore.push(version);
        }

        const vers = versionsStore
          .filter((v) => v.templateId === tmpl.id)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return { ...tmpl, versions: vers };
      },
    },
    document: {
      findFirst: async ({ where }: any) => {
        if (where.id === 'doc-inv-1') {
          return {
            id: 'doc-inv-1',
            companyId: 'comp-1',
            documentNumber: 'INV-2026-000001',
            documentType: DocumentType.INVOICE,
            title: 'Cement Supply Invoice',
            issueDate: new Date('2026-10-24'),
            status: 'APPROVED',
            paymentStatus: 'UNPAID',
            currency: 'NGN',
            subtotalAmount: '200000.00',
            taxAmount: '15000.00',
            discountAmount: '0.00',
            totalAmount: '215000.00',
            balanceDue: '215000.00',
            company: {
              name: 'AOA 77 COMPANY LTD',
              legalName: 'AOA 77 COMPANY LTD',
              rcNumber: '9905345...',
              tin: '2622739227683',
              address: '1 Alade Ibukun Close, Ewupe, Ota',
              email: 'contact@aoa77.com',
              phone: '+234 803 000 0000',
              settings: {
                bankName: 'Globus Bank',
                bankAccountNumber: '1000652112',
                bankAccountName: 'AOA 77 COMPANY LTD',
                showBankDetailsOnInvoice: true,
              },
            },
            client: {
              name: 'Dangote Cement Distributors',
              email: 'procurement@dangote.com',
              phone: '+234 801 111 2222',
              address: 'Plot 10 Industrial Way, Ikeja',
            },
            invoice: {
              poNumber: 'PO-9988',
              paymentTerms: 'Net 30 Days',
              dueDate: new Date('2026-11-24'),
              items: [
                {
                  lineNumber: 1,
                  description: 'Portland Cement Grade 42.5R (Live Mutated)',
                  quantity: '500',
                  unit: 'Bags',
                  unitPrice: '4000.00',
                  taxAmount: '150000.00',
                  lineTotal: '2150000.00',
                },
              ],
            },
            versions: [
              {
                id: 'ver-snap-1',
                versionNumber: 1,
                snapshotData: {
                  document: {
                    documentNumber: 'INV-2026-000001',
                    title: 'Cement Supply Invoice (Frozen v1)',
                    issueDate: '2026-10-24',
                    status: 'APPROVED',
                    currency: 'NGN',
                    subtotalAmount: '200000.00',
                    taxAmount: '15000.00',
                    discountAmount: '0.00',
                    totalAmount: '215000.00',
                    balanceDue: '215000.00',
                  },
                  company: {
                    name: 'AOA 77 COMPANY LTD',
                    rcNumber: '9905345...',
                    tin: '2622739227683',
                    address: '1 Alade Ibukun Close, Ewupe, Ota',
                    settings: {
                      bankName: 'Globus Bank',
                      bankAccountNumber: '1000652112',
                      showBankDetailsOnInvoice: true,
                    },
                  },
                  client: {
                    name: 'Dangote Cement Distributors',
                  },
                  invoice: {
                    poNumber: 'PO-9988',
                    items: [
                      {
                        lineNumber: 1,
                        description: 'Portland Cement Grade 42.5R (Original Snapshot v1)',
                        quantity: 100,
                        unit: 'Bags',
                        unitPrice: '2000.00',
                        lineGross: 200000,
                        discountAmount: 0,
                        taxAmount: 15000,
                        lineTotal: 215000,
                      },
                    ],
                  },
                },
              },
            ],
          };
        }
        return null;
      },
    },
  };

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogsStore.push(entry);
    },
  };

  const templatesService = new TemplatesService(mockPrisma, mockAuditService);

  await t.test('1. Invoice HTML renderer includes company metadata, banking, and line items', () => {
    const html = renderInvoiceHtml({
      company: {
        name: 'AOA 77 COMPANY LTD',
        rcNumber: '9905345...',
        tin: '2622739227683',
        address: '1 Alade Ibukun Close, Ewupe, Ota',
        settings: {
          bankName: 'Globus Bank',
          bankAccountNumber: '1000652112',
          bankAccountName: 'AOA 77 COMPANY LTD',
          showBankDetailsOnInvoice: true,
        },
      },
      documentNumber: 'INV-2026-000042',
      title: 'Tax Invoice',
      currency: 'NGN',
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      subtotal: '200000.00',
      taxAmount: '15000.00',
      discountAmount: '0.00',
      totalAmount: '215000.00',
      balanceDue: '215000.00',
      client: {
        name: 'Dangote Cement Distributors',
        address: 'Plot 10 Industrial Way, Ikeja',
      },
      invoice: {
        poNumber: 'PO-1234',
        paymentTerms: 'Due upon receipt',
        items: [
          {
            lineNumber: 1,
            description: 'Portland Limestone Cement 50kg',
            quantity: 100,
            unit: 'Bags',
            unitPrice: 2000,
            lineGross: 200000,
            discountAmount: 0,
            taxAmount: 15000,
            lineTotal: 215000,
          },
        ],
      },
    });

    assert.ok(html.includes('AOA 77 COMPANY LTD'));
    assert.ok(html.includes('RC: 9905345...'));
    assert.ok(html.includes('2622739227683'));
    assert.ok(html.includes('Globus Bank'));
    assert.ok(html.includes('1000652112'));
    assert.ok(html.includes('Portland Limestone Cement 50kg'));
    assert.ok(html.includes('INV-2026-000042'));
    assert.ok(html.includes('215,000.00'));
  });

  await t.test('2. Waybill HTML renderer includes logistics, carrier, and 3 signature blocks', () => {
    const html = renderWaybillHtml({
      company: {
        name: 'AOA 77 LOGISTICS',
        address: 'Depot 1, Lagos',
        phone: '+234 803 000 0000',
      },
      documentNumber: 'WB-2026-000010',
      title: 'Waybill & Delivery Note',
      status: 'IN_TRANSIT',
      client: {
        name: 'Ikeja Consignee Hub',
        address: 'Plot 5 Commercial Road, Ikeja',
      },
      waybill: {
        originAddress: 'Ota Central Warehouse',
        destinationAddress: 'Plot 5 Commercial Road, Ikeja',
        vehicleNumber: 'AAA-123-XY',
        driverName: 'Ibrahim Musa',
        driverPhone: '+234 802 333 4444',
        trackingNumber: 'TRK-99001',
        deliveryStatus: 'IN_TRANSIT',
        items: [
          {
            lineNumber: 1,
            description: 'Shrink-wrapped Cement Pallets',
            quantity: 50,
            unit: 'Pallets',
            weightKg: 2500,
            packageCount: 50,
            packageType: 'Pallets',
          },
        ],
      },
    });

    assert.ok(html.includes('WAYBILL / DELIVERY NOTE'));
    assert.ok(html.includes('WB-2026-000010'));
    assert.ok(html.includes('AAA-123-XY'));
    assert.ok(html.includes('Ibrahim Musa'));
    assert.ok(html.includes('TRK-99001'));
    assert.ok(html.includes('1. Dispatched By'));
    assert.ok(html.includes('2. Carrier Acknowledgement'));
    assert.ok(html.includes('3. Consignee Delivery Receipt'));
  });

  await t.test('3. Letter HTML renderer strips unsafe scripts and renders corporate correspondence', () => {
    const html = renderLetterHtml({
      company: {
        name: 'AOA 77 COMPANY LTD',
        address: 'Ota Headquarters',
        email: 'info@aoa77.com',
      },
      documentNumber: 'LET-2026-000005',
      title: 'Formal Notice',
      status: 'APPROVED',
      letter: {
        recipientName: 'The Managing Director',
        recipientOrganization: 'Apex Construction Ltd',
        subject: 'Contract Award Notification',
        bodyHtml: '<p>We are pleased to notify you.<script>alert("hacked")</script></p>',
        signatoryName: 'Akinola O.',
        signatoryTitle: 'Executive Director',
      },
    });

    assert.ok(html.includes('AOA 77 COMPANY LTD'));
    assert.ok(html.includes('Our Ref:</strong> LET-2026-000005'));
    assert.ok(html.includes('Contract Award Notification'));
    assert.ok(html.includes('We are pleased to notify you.'));
    assert.ok(!html.includes('<script>'), 'Dangerous script tag was sanitized');
    assert.ok(html.includes('Akinola O.'));
    assert.ok(html.includes('Executive Director'));
  });

  await t.test('4. TemplatesService creates template and initial version (v1)', async () => {
    const tmpl = await templatesService.create(
      'comp-1',
      {
        documentType: DocumentType.INVOICE,
        name: 'Corporate Dark',
        code: 'INV-CORP-DARK',
        isDefault: true,
        htmlStructure: '<div class="invoice">{{content}}</div>',
        cssStyles: '.invoice { color: #1e293b; }',
      },
      'admin-1',
    );

    assert.strictEqual(tmpl.code, 'INV-CORP-DARK');
    assert.strictEqual(tmpl.versions.length, 1);
    assert.strictEqual(tmpl.versions[0].versionNumber, 1);
  });

  await t.test('5. Rejects duplicate template code within same tenant company', async () => {
    await assert.rejects(
      async () => {
        await templatesService.create(
          'comp-1',
          {
            documentType: DocumentType.INVOICE,
            name: 'Corporate Dark Duplicate',
            code: 'INV-CORP-DARK',
            htmlStructure: '<div></div>',
            cssStyles: '',
          },
          'admin-1',
        );
      },
      /already exists for this company/,
    );
  });

  await t.test('6. Updating template layout publishes immutable new TemplateVersion (v2)', async () => {
    const tmpl = templatesStore.find((t) => t.code === 'INV-CORP-DARK');
    const updated = await templatesService.update(
      'comp-1',
      tmpl.id,
      {
        cssStyles: '.invoice { color: #000000; font-size: 11pt; }',
      },
      'admin-1',
    );

    assert.strictEqual(updated.versions.length, 2);
    assert.strictEqual(updated.versions[0].versionNumber, 2);
  });

  await t.test('7. renderDocumentHtml strictly honors frozen snapshotData over mutating DB state', async () => {
    const renderedHtml = await templatesService.renderDocumentHtml('comp-1', 'doc-inv-1', 1);

    // Snapshot has 100 bags @ 2000; Live database has mutated to 500 bags @ 4000
    assert.ok(renderedHtml.includes('Original Snapshot v1'));
    assert.ok(!renderedHtml.includes('Live Mutated'));
    assert.ok(renderedHtml.includes('215,000.00'));
  });
});
