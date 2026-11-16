import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  InvoicePaymentStatus,
  Prisma,
  WaybillDeliveryStatus,
} from '@prisma/client';
import { DocumentConversionService } from './document-conversion.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentConversionService', () => {
  let service: DocumentConversionService;

  const COMPANY_ID = 'comp-aoa77-001';
  const OTHER_COMPANY_ID = 'comp-other-999';
  const ACTOR_ID = 'user-manager-001';

  // Simulated in-memory transactional state to verify atomic commit & rollback behavior
  let documentsStore: any[];
  let invoicesStore: any[];
  let waybillsStore: any[];

  let mockTx: {
    document: { create: jest.Mock };
    waybill: { create: jest.Mock; update: jest.Mock };
    invoice: { create: jest.Mock };
  };

  let mockPrismaService: {
    invoice: { findFirst: jest.Mock };
    waybill: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    documentsStore = [];
    invoicesStore = [];
    waybillsStore = [];

    mockTx = {
      document: {
        create: jest.fn(),
      },
      waybill: {
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
      },
    };

    mockPrismaService = {
      invoice: {
        findFirst: jest.fn(),
      },
      waybill: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<any>) => {
        // Snapshot stores prior to transaction execution so a mid-transaction error rolls back state
        const docSnapshot = [...documentsStore];
        const invSnapshot = [...invoicesStore];
        const wbSnapshot = [...waybillsStore];

        try {
          return await callback(mockTx);
        } catch (error) {
          documentsStore = docSnapshot;
          invoicesStore = invSnapshot;
          waybillsStore = wbSnapshot;
          throw error;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentConversionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DocumentConversionService>(DocumentConversionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Invoice to Waybill Conversion (createWaybillFromInvoice)
  // ===========================================================================
  describe('createWaybillFromInvoice', () => {
    const validInvoiceFixture = {
      id: 'inv-1001',
      companyId: COMPANY_ID,
      documentId: 'doc-inv-1001',
      currency: 'NGN',
      exchangeRate: new Prisma.Decimal(1),
      paymentStatus: InvoicePaymentStatus.UNPAID,
      deletedAt: null,
      document: {
        id: 'doc-inv-1001',
        companyId: COMPANY_ID,
        clientId: 'client-001',
        branchId: 'branch-lagos',
        departmentId: 'dept-logistics',
        documentType: DocumentType.INVOICE,
        documentNumber: 'INV-2026-000001',
        title: 'Supply of Industrial Valves',
        status: DocumentStatus.ISSUED,
        currency: 'NGN',
        exchangeRate: new Prisma.Decimal(1),
        createdById: ACTOR_ID,
        deletedAt: null,
        company: {
          id: COMPANY_ID,
          name: 'AOA 77 Logistics Ltd',
          legalName: 'AOA 77 Logistics Limited',
          address: '14 Wharf Road, Apapa, Lagos',
          phone: '+2348000000077',
          email: 'ops@aoa77.ng',
        },
        client: {
          id: 'client-001',
          name: 'Dangote Refinery PLC',
          companyName: 'Dangote Oil Refining Company',
          phone: '+2348011112222',
          email: 'procurement@dangote.com',
          addresses: [
            {
              id: 'addr-1',
              addressLine1: 'Lekki Free Trade Zone',
              city: 'Ibeju-Lekki',
              state: 'Lagos',
              isDefault: true,
            },
          ],
        },
      },
      items: [
        {
          id: 'inv-item-1',
          lineNumber: 1,
          description: 'High-Pressure Gate Valve 6-inch',
          quantity: new Prisma.Decimal(10),
          unit: 'Pcs',
          unitPrice: new Prisma.Decimal(45000),
          taxRate: new Prisma.Decimal(7.5),
          lineTotal: new Prisma.Decimal(483750),
        },
      ],
    };

    it('creates a parent Document (WAYBILL), generates a unique tracking code, links invoiceId, and returns the populated waybill record', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(validInvoiceFixture);

      mockTx.document.create.mockImplementation(async ({ data }) => {
        const createdDoc = {
          id: 'doc-wb-2001',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        documentsStore.push(createdDoc);
        return createdDoc;
      });

      mockTx.waybill.create.mockImplementation(async ({ data }) => {
        const createdWaybill = {
          id: 'wb-2001',
          ...data,
          document: documentsStore[0],
          invoice: validInvoiceFixture,
          items: (data.items?.create || []).map((item: any, idx: number) => ({
            id: `wb-item-${idx + 1}`,
            waybillId: 'wb-2001',
            ...item,
          })),
        };
        waybillsStore.push(createdWaybill);
        return createdWaybill;
      });

      const result = await service.createWaybillFromInvoice(
        validInvoiceFixture.id,
        COMPANY_ID,
        ACTOR_ID,
      );

      expect(mockPrismaService.invoice.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // Verify parent Document creation with type WAYBILL
      expect(mockTx.document.create).toHaveBeenCalledTimes(1);
      expect(mockTx.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            clientId: 'client-001',
            documentType: DocumentType.WAYBILL,
            status: DocumentStatus.DRAFT,
            createdById: ACTOR_ID,
          }),
        }),
      );

      // Verify Waybill creation with unique tracking code and invoiceId link
      expect(mockTx.waybill.create).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.id).toBe('wb-2001');
      expect(result.invoiceId).toBe(validInvoiceFixture.id);
      expect(result.documentId).toBe('doc-wb-2001');
      expect(result.document.documentType).toBe(DocumentType.WAYBILL);
      expect(result.trackingNumber).toMatch(/^TRK-\d{4}-[A-F0-9]{8}$/);
      expect(result.deliveryStatus).toBe(WaybillDeliveryStatus.PREPARING);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].description).toBe('High-Pressure Gate Valve 6-inch');
    });

    it('throws NotFoundException when invoiceId does not exist', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.createWaybillFromInvoice('non-existent-invoice-id', COMPANY_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockTx.document.create).not.toHaveBeenCalled();
      expect(mockTx.waybill.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invoice belongs to an unauthorized tenant companyId', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue({
        ...validInvoiceFixture,
        companyId: OTHER_COMPANY_ID,
        document: {
          ...validInvoiceFixture.document,
          companyId: OTHER_COMPANY_ID,
        },
      });

      await expect(
        service.createWaybillFromInvoice(validInvoiceFixture.id, COMPANY_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. Waybill to Invoice Conversion (createInvoiceFromWaybill)
  // ===========================================================================
  describe('createInvoiceFromWaybill', () => {
    const unbilledWaybillFixture = {
      id: 'wb-3001',
      companyId: COMPANY_ID,
      documentId: 'doc-wb-3001',
      invoiceId: null,
      currency: 'NGN',
      exchangeRate: new Prisma.Decimal(1),
      deliveryStatus: WaybillDeliveryStatus.DELIVERED,
      deletedAt: null,
      document: {
        id: 'doc-wb-3001',
        companyId: COMPANY_ID,
        clientId: 'client-001',
        branchId: 'branch-lagos',
        departmentId: 'dept-logistics',
        documentType: DocumentType.INVOICE,
        documentNumber: 'WB-2026-000010',
        title: 'Waybill Dispatch to Lekki',
        status: DocumentStatus.COMPLETED,
        currency: 'NGN',
        exchangeRate: new Prisma.Decimal(1),
        createdById: ACTOR_ID,
        deletedAt: null,
      },
      items: [
        {
          id: 'wb-item-1',
          lineNumber: 1,
          description: 'Seamless Carbon Steel Pipe',
          quantity: new Prisma.Decimal(20),
          unit: 'Lengths',
        },
      ],
    };

    it('creates a parent Document (INVOICE), creates a new Invoice record, updates waybill.invoiceId, and returns the linked invoice', async () => {
      mockPrismaService.waybill.findFirst.mockResolvedValue(unbilledWaybillFixture);
      waybillsStore.push({ ...unbilledWaybillFixture });

      mockTx.document.create.mockImplementation(async ({ data }) => {
        const createdDoc = {
          id: 'doc-inv-4001',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        documentsStore.push(createdDoc);
        return createdDoc;
      });

      mockTx.invoice.create.mockImplementation(async ({ data }) => {
        const createdInvoice = {
          id: 'inv-4001',
          ...data,
          document: documentsStore[0],
          items: (data.items?.create || []).map((item: any, idx: number) => ({
            id: `inv-item-${idx + 1}`,
            invoiceId: 'inv-4001',
            ...item,
          })),
        };
        invoicesStore.push(createdInvoice);
        return createdInvoice;
      });

      mockTx.waybill.update.mockImplementation(async ({ where, data }) => {
        const idx = waybillsStore.findIndex((w) => w.id === where.id);
        if (idx !== -1) {
          waybillsStore[idx] = { ...waybillsStore[idx], ...data };
          return waybillsStore[idx];
        }
        return { id: where.id, ...data };
      });

      const result = await service.createInvoiceFromWaybill(
        unbilledWaybillFixture.id,
        COMPANY_ID,
        ACTOR_ID,
        { defaultUnitPrice: 25000, taxRate: 7.5 },
      );

      expect(mockPrismaService.waybill.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // Verify parent Document creation with type INVOICE
      expect(mockTx.document.create).toHaveBeenCalledTimes(1);
      expect(mockTx.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            clientId: 'client-001',
            documentType: DocumentType.INVOICE,
            status: DocumentStatus.DRAFT,
            subtotal: '500000.00',
            taxAmount: '37500.00',
            totalAmount: '537500.00',
          }),
        }),
      );

      // Verify Invoice creation
      expect(mockTx.invoice.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('inv-4001');
      expect(result.documentId).toBe('doc-inv-4001');
      expect(result.document.documentType).toBe(DocumentType.INVOICE);
      expect(result.paymentStatus).toBe(InvoicePaymentStatus.UNPAID);
      expect(result.items).toHaveLength(1);

      // Verify Waybill foreign key update linking back to the new Invoice
      expect(mockTx.waybill.update).toHaveBeenCalledTimes(1);
      expect(mockTx.waybill.update).toHaveBeenCalledWith({
        where: { id: unbilledWaybillFixture.id },
        data: { invoiceId: 'inv-4001' },
      });
      expect(waybillsStore[0].invoiceId).toBe('inv-4001');
    });

    it('throws BadRequestException when attempting to convert a waybill that is already linked to an invoice', async () => {
      mockPrismaService.waybill.findFirst.mockResolvedValue({
        ...unbilledWaybillFixture,
        invoiceId: 'inv-already-linked-999',
      });

      await expect(
        service.createInvoiceFromWaybill(unbilledWaybillFixture.id, COMPANY_ID, ACTOR_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockTx.document.create).not.toHaveBeenCalled();
      expect(mockTx.invoice.create).not.toHaveBeenCalled();
      expect(mockTx.waybill.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when waybillId does not exist or is unauthorized', async () => {
      mockPrismaService.waybill.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvoiceFromWaybill('missing-waybill-id', COMPANY_ID, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 3. Transactional Integrity & Rollback
  // ===========================================================================
  describe('Transactional Integrity & Rollback', () => {
    it('rolls back completely and prevents orphaned Document records if waybill creation fails inside createWaybillFromInvoice', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue({
        id: 'inv-5001',
        companyId: COMPANY_ID,
        documentId: 'doc-inv-5001',
        currency: 'NGN',
        exchangeRate: new Prisma.Decimal(1),
        deletedAt: null,
        document: {
          id: 'doc-inv-5001',
          companyId: COMPANY_ID,
          clientId: 'client-001',
          branchId: null,
          departmentId: null,
          documentType: DocumentType.INVOICE,
          documentNumber: 'INV-2026-000055',
          currency: 'NGN',
          exchangeRate: new Prisma.Decimal(1),
          createdById: ACTOR_ID,
          deletedAt: null,
        },
        items: [
          {
            lineNumber: 1,
            description: 'Heavy Duty Flange',
            quantity: new Prisma.Decimal(5),
            unit: 'Pcs',
          },
        ],
      });

      // Step 1 succeeds and stages a parent Document in the transaction
      mockTx.document.create.mockImplementation(async ({ data }) => {
        const stagedDoc = { id: 'doc-orphan-candidate', ...data };
        documentsStore.push(stagedDoc);
        return stagedDoc;
      });

      // Step 2 fails inside the transaction (e.g., database constraint error)
      mockTx.waybill.create.mockRejectedValue(
        new Error('Simulated DB error during waybill creation'),
      );

      await expect(
        service.createWaybillFromInvoice('inv-5001', COMPANY_ID, ACTOR_ID),
      ).rejects.toThrow('Simulated DB error during waybill creation');

      // Verify transaction was invoked and rolled back cleanly with zero orphaned documents or waybills
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.document.create).toHaveBeenCalledTimes(1);
      expect(mockTx.waybill.create).toHaveBeenCalledTimes(1);
      expect(documentsStore).toHaveLength(0);
      expect(waybillsStore).toHaveLength(0);
    });

    it('rolls back completely and prevents orphaned Document/Invoice records if waybill foreign-key update fails inside createInvoiceFromWaybill', async () => {
      const initialWaybill = {
        id: 'wb-6001',
        companyId: COMPANY_ID,
        documentId: 'doc-wb-6001',
        invoiceId: null,
        currency: 'NGN',
        exchangeRate: new Prisma.Decimal(1),
        deletedAt: null,
        document: {
          id: 'doc-wb-6001',
          companyId: COMPANY_ID,
          clientId: 'client-001',
          branchId: null,
          departmentId: null,
          documentType: DocumentType.WAYBILL,
          documentNumber: 'WB-2026-000061',
          currency: 'NGN',
          exchangeRate: new Prisma.Decimal(1),
          createdById: ACTOR_ID,
          deletedAt: null,
        },
        items: [
          {
            lineNumber: 1,
            description: 'Industrial Pump Assembly',
            quantity: new Prisma.Decimal(2),
            unit: 'Units',
          },
        ],
      };

      waybillsStore.push({ ...initialWaybill });
      mockPrismaService.waybill.findFirst.mockResolvedValue(initialWaybill);

      // Step 1 succeeds: parent Document created
      mockTx.document.create.mockImplementation(async ({ data }) => {
        const stagedDoc = { id: 'doc-inv-orphan-candidate', ...data };
        documentsStore.push(stagedDoc);
        return stagedDoc;
      });

      // Step 2 succeeds: Invoice created
      mockTx.invoice.create.mockImplementation(async ({ data }) => {
        const stagedInvoice = { id: 'inv-orphan-candidate', ...data };
        invoicesStore.push(stagedInvoice);
        return stagedInvoice;
      });

      // Step 3 fails: updating waybill.invoiceId throws error
      mockTx.waybill.update.mockRejectedValue(
        new Error('Simulated DB lock timeout while linking waybill to invoice'),
      );

      await expect(
        service.createInvoiceFromWaybill('wb-6001', COMPANY_ID, ACTOR_ID, {
          defaultUnitPrice: 120000,
        }),
      ).rejects.toThrow('Simulated DB lock timeout while linking waybill to invoice');

      // Verify rollback restored all stores and prevented orphaned Document / Invoice records
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(documentsStore).toHaveLength(0);
      expect(invoicesStore).toHaveLength(0);
      expect(waybillsStore).toHaveLength(1);
      expect(waybillsStore[0].invoiceId).toBeNull();
    });
  });
});

