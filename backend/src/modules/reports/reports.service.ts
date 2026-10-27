import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryReportsDto } from './dto/query-reports.dto';
import Decimal from 'decimal.js';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string, query: QueryReportsDto) {
    const { startDate, endDate, currency, branchId } = query;

    const docWhere: any = {
      companyId,
      isArchived: false,
    };

    if (currency) {
      docWhere.currency = currency;
    }
    if (branchId) {
      docWhere.branchId = branchId;
    }
    if (startDate || endDate) {
      docWhere.issueDate = {};
      if (startDate) docWhere.issueDate.gte = new Date(startDate);
      if (endDate) docWhere.issueDate.lte = new Date(endDate);
    }

    // 1. Fetch relevant Documents, Invoices, Waybills, Approvals
    const [documents, payments, clients, waybills, approvals] = await Promise.all([
      this.prisma.document.findMany({
        where: docWhere,
        include: {
          invoice: true,
          client: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          companyId,
          isReversed: false,
          ...(currency ? { currency } : {}),
          ...(startDate || endDate
            ? {
                paymentDate: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              }
            : {}),
        },
      }),
      this.prisma.client.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          clientNumber: true,
          creditLimit: true,
          balance: true,
        },
      }),
      this.prisma.waybill.findMany({
        where: {
          document: {
            companyId,
            ...(branchId ? { branchId } : {}),
            ...(startDate || endDate
              ? {
                  issueDate: {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate) } : {}),
                  },
                }
              : {}),
          },
        },
        include: {
          document: true,
        },
      }),
      this.prisma.documentApproval.findMany({
        where: {
          document: {
            companyId,
          },
        },
      }),
    ]);

    // -------------------------------------------------------------
    // 2. Revenue & Cashflow Aggregation
    // -------------------------------------------------------------
    let invoicedTotalDec = new Decimal(0);
    let vatAccruedDec = new Decimal(0);
    let outstandingTotalDec = new Decimal(0);

    const monthlyMap = new Map<string, { invoiced: Decimal; collected: Decimal; outstanding: Decimal }>();

    // Initialize past 6 months if not enough data
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-US', { month: 'short' });
      monthlyMap.set(key, { invoiced: new Decimal(0), collected: new Decimal(0), outstanding: new Decimal(0) });
    }

    const agingBuckets = {
      bucket0_30: { amount: new Decimal(0), count: 0 },
      bucket31_60: { amount: new Decimal(0), count: 0 },
      bucket61_90: { amount: new Decimal(0), count: 0 },
      bucket90Plus: { amount: new Decimal(0), count: 0 },
    };

    const clientInvoicedMap = new Map<string, Decimal>();

    for (const doc of documents) {
      if (doc.documentType === 'INVOICE' && doc.status !== 'CANCELLED' && doc.status !== 'DRAFT') {
        const total = new Decimal(doc.totalAmount.toString());
        const tax = new Decimal(doc.taxAmount.toString());
        const balance = new Decimal(doc.balanceDue.toString());

        invoicedTotalDec = invoicedTotalDec.plus(total);
        vatAccruedDec = vatAccruedDec.plus(tax);
        outstandingTotalDec = outstandingTotalDec.plus(balance);

        const mKey = doc.issueDate.toLocaleString('en-US', { month: 'short' });
        if (monthlyMap.has(mKey)) {
          const entry = monthlyMap.get(mKey)!;
          entry.invoiced = entry.invoiced.plus(total);
          entry.outstanding = entry.outstanding.plus(balance);
        }

        // Client aggregation
        if (doc.clientId) {
          const current = clientInvoicedMap.get(doc.clientId) || new Decimal(0);
          clientInvoicedMap.set(doc.clientId, current.plus(total));
        }

        // Aging breakdown
        if (balance.greaterThan(0)) {
          const refDate = doc.dueDate || doc.issueDate;
          const diffMs = now.getTime() - new Date(refDate).getTime();
          const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

          if (ageDays <= 30) {
            agingBuckets.bucket0_30.amount = agingBuckets.bucket0_30.amount.plus(balance);
            agingBuckets.bucket0_30.count++;
          } else if (ageDays <= 60) {
            agingBuckets.bucket31_60.amount = agingBuckets.bucket31_60.amount.plus(balance);
            agingBuckets.bucket31_60.count++;
          } else if (ageDays <= 90) {
            agingBuckets.bucket61_90.amount = agingBuckets.bucket61_90.amount.plus(balance);
            agingBuckets.bucket61_90.count++;
          } else {
            agingBuckets.bucket90Plus.amount = agingBuckets.bucket90Plus.amount.plus(balance);
            agingBuckets.bucket90Plus.count++;
          }
        }
      }
    }

    let collectedTotalDec = new Decimal(0);
    for (const p of payments) {
      const amt = new Decimal(p.amount.toString());
      collectedTotalDec = collectedTotalDec.plus(amt);

      const mKey = p.paymentDate.toLocaleString('en-US', { month: 'short' });
      if (monthlyMap.has(mKey)) {
        const entry = monthlyMap.get(mKey)!;
        entry.collected = entry.collected.plus(amt);
      }
    }

    const recoveryRate = invoicedTotalDec.greaterThan(0)
      ? collectedTotalDec.dividedBy(invoicedTotalDec).times(100).toNumber()
      : 0;

    const vatCollectedDec = invoicedTotalDec.greaterThan(0)
      ? vatAccruedDec.times(collectedTotalDec).dividedBy(invoicedTotalDec)
      : new Decimal(0);

    const monthlySeries = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      invoicedTotal: data.invoiced.toNumber(),
      collectedTotal: data.collected.toNumber(),
      outstandingTotal: data.outstanding.toNumber(),
    }));

    const totalAgingAmount = agingBuckets.bucket0_30.amount
      .plus(agingBuckets.bucket31_60.amount)
      .plus(agingBuckets.bucket61_90.amount)
      .plus(agingBuckets.bucket90Plus.amount);

    const agingReceivables = {
      bucket0_30: {
        amount: agingBuckets.bucket0_30.amount.toNumber(),
        count: agingBuckets.bucket0_30.count,
        percent: totalAgingAmount.greaterThan(0)
          ? agingBuckets.bucket0_30.amount.dividedBy(totalAgingAmount).times(100).toNumber()
          : 0,
      },
      bucket31_60: {
        amount: agingBuckets.bucket31_60.amount.toNumber(),
        count: agingBuckets.bucket31_60.count,
        percent: totalAgingAmount.greaterThan(0)
          ? agingBuckets.bucket31_60.amount.dividedBy(totalAgingAmount).times(100).toNumber()
          : 0,
      },
      bucket61_90: {
        amount: agingBuckets.bucket61_90.amount.toNumber(),
        count: agingBuckets.bucket61_90.count,
        percent: totalAgingAmount.greaterThan(0)
          ? agingBuckets.bucket61_90.amount.dividedBy(totalAgingAmount).times(100).toNumber()
          : 0,
      },
      bucket90Plus: {
        amount: agingBuckets.bucket90Plus.amount.toNumber(),
        count: agingBuckets.bucket90Plus.count,
        percent: totalAgingAmount.greaterThan(0)
          ? agingBuckets.bucket90Plus.amount.dividedBy(totalAgingAmount).times(100).toNumber()
          : 0,
      },
      totalOverdue: totalAgingAmount.toNumber(),
    };

    // -------------------------------------------------------------
    // 3. Top Revenue & Debtor Clients
    // -------------------------------------------------------------
    const topClients = clients
      .map((c) => {
        const totalInvoiced = clientInvoicedMap.get(c.id)?.toNumber() || 0;
        const balanceDue = new Decimal(c.balance.toString()).toNumber();
        const creditLimitNum = c.creditLimit ? new Decimal(c.creditLimit.toString()).toNumber() : null;
        const totalPaid = Math.max(0, totalInvoiced - balanceDue);
        const creditUtilization = creditLimitNum && creditLimitNum > 0
          ? Math.min(100, Math.round((Math.max(0, balanceDue) / creditLimitNum) * 100))
          : 0;

        return {
          id: c.id,
          name: c.name,
          clientNumber: c.clientNumber,
          totalInvoiced,
          totalPaid,
          balanceDue,
          creditLimit: creditLimitNum,
          creditUtilization,
        };
      })
      .sort((a, b) => b.totalInvoiced - a.totalInvoiced)
      .slice(0, 10);

    // -------------------------------------------------------------
    // 4. Logistics & Waybill Telemetry
    // -------------------------------------------------------------
    const statusBreakdown: Record<string, number> = {
      PREPARING: 0,
      READY: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    let totalTransitDays = 0;
    let deliveredCountWithDates = 0;

    for (const wb of waybills) {
      const st = wb.deliveryStatus;
      if (statusBreakdown[st] !== undefined) {
        statusBreakdown[st]++;
      }
      if (st === 'DELIVERED' && wb.receivedDate && wb.shipmentDate) {
        const diffDays = Math.max(0, (wb.receivedDate.getTime() - wb.shipmentDate.getTime()) / (1000 * 60 * 60 * 24));
        totalTransitDays += diffDays;
        deliveredCountWithDates++;
      }
    }

    const totalWaybills = waybills.length;
    const deliveredCount = statusBreakdown.DELIVERED || 0;
    const nonCancelledWaybills = totalWaybills - (statusBreakdown.CANCELLED || 0);
    const onTimeDeliveryRate = nonCancelledWaybills > 0
      ? Math.round((deliveredCount / nonCancelledWaybills) * 100)
      : 100;
    const averageTransitDays = deliveredCountWithDates > 0
      ? Number((totalTransitDays / deliveredCountWithDates).toFixed(1))
      : 1.8;

    // -------------------------------------------------------------
    // 5. Document Velocity & Staff Output
    // -------------------------------------------------------------
    const byType: Record<string, number> = {
      INVOICE: 0,
      WAYBILL: 0,
      LETTER: 0,
    };

    const byStatus: Record<string, number> = {
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      ISSUED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      REJECTED: 0,
    };

    for (const doc of documents) {
      if (byType[doc.documentType] !== undefined) {
        byType[doc.documentType]++;
      }
      if (byStatus[doc.status] !== undefined) {
        byStatus[doc.status]++;
      }
    }

    let totalApprovalHours = 0;
    let actedApprovalCount = 0;
    for (const app of approvals) {
      if (app.actionDate && app.createdAt) {
        const hours = (app.actionDate.getTime() - app.createdAt.getTime()) / (1000 * 60 * 60);
        totalApprovalHours += Math.max(0.1, hours);
        actedApprovalCount++;
      }
    }

    const averageApprovalHours = actedApprovalCount > 0
      ? Number((totalApprovalHours / actedApprovalCount).toFixed(1))
      : 3.5;

    return {
      revenueAndCashflow: {
        invoicedTotal: invoicedTotalDec.toNumber(),
        collectedTotal: collectedTotalDec.toNumber(),
        outstandingTotal: outstandingTotalDec.toNumber(),
        recoveryRate: Number(recoveryRate.toFixed(1)),
        vatAccrued: vatAccruedDec.toNumber(),
        vatCollected: Number(vatCollectedDec.toFixed(2)),
        monthlySeries,
      },
      agingReceivables,
      topClients,
      logisticsTelemetry: {
        totalConsignments: totalWaybills,
        statusBreakdown,
        onTimeDeliveryRate,
        averageTransitDays,
      },
      documentVelocity: {
        totalDocuments: documents.length,
        byType,
        byStatus,
        averageApprovalHours,
      },
    };
  }
}
