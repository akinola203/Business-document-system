import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the current company profile, settings, and summary stats.
   */
  async getCurrentCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        settings: true,
        _count: {
          select: {
            departments: { where: { isActive: true } },
            branches: { where: { isActive: true } },
            clients: { where: { status: 'ACTIVE' } },
            companyUsers: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found.`);
    }

    return company;
  }

  /**
   * Updates core corporate identity, registration, address, and legal details.
   */
  async updateCompany(companyId: string, updateDto: UpdateCompanyDto, actorId: string) {
    const current = await this.getCurrentCompany(companyId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.company.update({
        where: { id: companyId },
        data: {
          ...updateDto,
        },
        include: {
          settings: true,
        },
      });

      // Record immutable audit trail
      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'COMPANY_PROFILE_UPDATED',
          entityType: 'Company',
          entityId: companyId,
          oldValues: {
            name: current.name,
            legalName: current.legalName,
            rcNumber: current.rcNumber,
            tin: current.tin,
            address: current.address,
            phone: current.phone,
            email: current.email,
            website: current.website,
            defaultCurrency: current.defaultCurrency,
          },
          newValues: updateDto as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });

    this.logger.log(`Company "${companyId}" profile updated by user "${actorId}".`);
    return updated;
  }

  /**
   * Updates banking details, tax policies, and document branding rules.
   */
  async updateCompanySettings(
    companyId: string,
    settingsDto: UpdateCompanySettingsDto,
    actorId: string,
  ) {
    // Ensure company exists
    await this.getCurrentCompany(companyId);

    const updatedSettings = await this.prisma.$transaction(async (tx) => {
      const currentSettings = await tx.companySetting.findUnique({
        where: { companyId },
      });

      const dataToSave: Prisma.CompanySettingUpdateInput = {
        ...settingsDto,
        defaultVatRate:
          settingsDto.defaultVatRate !== undefined
            ? new Prisma.Decimal(settingsDto.defaultVatRate)
            : undefined,
      };

      const result = await tx.companySetting.upsert({
        where: { companyId },
        update: dataToSave,
        create: {
          companyId,
          bankName: settingsDto.bankName,
          bankAccountNumber: settingsDto.bankAccountNumber,
          bankAccountName: settingsDto.bankAccountName,
          bankSortCode: settingsDto.bankSortCode,
          showBankDetailsOnInvoice: settingsDto.showBankDetailsOnInvoice ?? true,
          showBankDetailsOnWaybill: settingsDto.showBankDetailsOnWaybill ?? false,
          showBankDetailsOnLetter: settingsDto.showBankDetailsOnLetter ?? false,
          defaultVatRate:
            settingsDto.defaultVatRate !== undefined
              ? new Prisma.Decimal(settingsDto.defaultVatRate)
              : new Prisma.Decimal(7.50),
          defaultPaymentTermsDays: settingsDto.defaultPaymentTermsDays ?? 30,
          allowSelfApproval: settingsDto.allowSelfApproval ?? false,
          metadata: (settingsDto.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'COMPANY_SETTINGS_UPDATED',
          entityType: 'CompanySetting',
          entityId: result.id,
          oldValues: currentSettings ? (currentSettings as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          newValues: settingsDto as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });

    this.logger.log(`Company "${companyId}" settings updated by user "${actorId}".`);
    return updatedSettings;
  }
}
