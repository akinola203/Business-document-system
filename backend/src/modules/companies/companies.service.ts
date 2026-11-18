import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCacheService } from '../cache/tenant-cache.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { Prisma } from '@prisma/client';
import { DEFAULT_AOA77_LOGO_DATA_URI } from '../../assets/aoa77-logo';

export const MAX_BRANDING_FILE_SIZE_BYTES = 2 * 1024 * 1024; // Strict 2MB file size limit
export const ALLOWED_BRANDING_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
export const ALLOWED_BRANDING_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

/**
 * Sanitizes an uploaded filename to strip path traversal (`..`, `/`, `\`, null bytes)
 * and block executable/script extensions.
 */
export function sanitizeBrandingFilename(rawFilename: string | undefined): string {
  const fallback = 'branding-asset.png';
  if (!rawFilename || typeof rawFilename !== 'string') {
    return fallback;
  }
  const withoutNull = rawFilename.replace(/\0/g, '').replace(/\\/g, '/');
  const base = path.posix.basename(withoutNull).trim();
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.');
  return safe || fallback;
}

/**
 * Verifies binary magic bytes for allowed raster image formats (`.png`, `.jpg`/`.jpeg`, `.webp`).
 */
export function verifyBrandingMagicBytes(buffer: Buffer, mime: string): boolean {
  if (!buffer || buffer.length === 0) return false;
  const normalizedMime = mime.toLowerCase().trim();

  if (normalizedMime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (normalizedMime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

export interface UploadedBrandingFiles {
  logo?: Express.Multer.File[];
  signatureSpecimen?: Express.Multer.File[];
  corporateSeal?: Express.Multer.File[];
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  private static readonly PROFILE_CACHE_TTL_SECONDS = 300;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: TenantCacheService,
  ) {}

  /**
   * Surfaces branding URLs stored in `settings.metadata` as top-level properties on `settings`
   * so both frontend components and PDF renderers can read `settings.logoUrl`, `settings.signatureSpecimenUrl`,
   * and `settings.corporateSealUrl` directly.
   */
  private enrichSettings<T extends Record<string, any> | null | undefined>(
    settings: T,
  ): (T & {
    logoUrl?: string | null;
    signatureSpecimenUrl?: string | null;
    corporateSealUrl?: string | null;
  }) {
    if (!settings) return settings as any;
    const meta =
      settings.metadata && typeof settings.metadata === 'object'
        ? (settings.metadata as Record<string, any>)
        : {};
    return {
      ...settings,
      logoUrl: settings.logoUrl ?? meta.logoUrl ?? DEFAULT_AOA77_LOGO_DATA_URI,
      signatureSpecimenUrl: settings.signatureSpecimenUrl ?? meta.signatureSpecimenUrl ?? null,
      corporateSealUrl: settings.corporateSealUrl ?? meta.corporateSealUrl ?? null,
    };
  }

  /**
   * Retrieves the current company profile, settings, and summary stats.
   * Uses tenant-scoped Redis caching to offload frequent read replica lookups.
   */
  async getCurrentCompany(companyId: string) {
    const loader = async () => {
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

      return {
        ...company,
        settings: this.enrichSettings(company.settings),
      };
    };

    if (this.cache) {
      return this.cache.getOrSetTenant(
        companyId,
        'company',
        'profile',
        CompaniesService.PROFILE_CACHE_TTL_SECONDS,
        loader,
      );
    }

    return loader();
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
          ...(updateDto.name !== undefined ? { name: updateDto.name } : {}),
          ...(updateDto.legalName !== undefined ? { legalName: updateDto.legalName } : {}),
          ...(updateDto.rcNumber !== undefined ? { rcNumber: updateDto.rcNumber } : {}),
          ...(updateDto.tin !== undefined ? { tin: updateDto.tin } : {}),
          ...(updateDto.address !== undefined ? { address: updateDto.address } : {}),
          ...(updateDto.email !== undefined ? { email: updateDto.email } : {}),
          ...(updateDto.phone !== undefined ? { phone: updateDto.phone } : {}),
          ...(updateDto.website !== undefined ? { website: updateDto.website } : {}),
          ...(updateDto.defaultCurrency !== undefined ? { defaultCurrency: updateDto.defaultCurrency } : {}),
        },
        include: {
          settings: true,
        },
      });

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

      return {
        ...result,
        settings: this.enrichSettings(result.settings),
      };
    });

    await this.cache?.invalidateTenantNamespace(companyId, 'company');
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
    await this.getCurrentCompany(companyId);

    const fileIdsToVerify = [
      settingsDto.logoFileId,
      settingsDto.stampFileId,
      settingsDto.signatureFileId,
    ].filter((fid): fid is string => Boolean(fid));

    if (fileIdsToVerify.length > 0 && (this.prisma as any).file?.findFirst) {
      for (const fileId of fileIdsToVerify) {
        const file = await this.prisma.file.findFirst({
          where: { id: fileId, companyId },
        });
        if (!file) {
          throw new NotFoundException(`Branding file with ID "${fileId}" not found in this company.`);
        }
      }
    }

    const updatedSettings = await this.prisma.$transaction(async (tx) => {
      const currentSettings = await tx.companySetting.findUnique({
        where: { companyId },
      });

      const existingMeta =
        currentSettings?.metadata && typeof currentSettings.metadata === 'object'
          ? (currentSettings.metadata as Record<string, any>)
          : {};

      const hasMetaUpdates =
        settingsDto.metadata !== undefined ||
        settingsDto.logoUrl !== undefined ||
        settingsDto.signatureSpecimenUrl !== undefined ||
        settingsDto.corporateSealUrl !== undefined;

      const mergedMetadata: Record<string, any> = {
        ...existingMeta,
        ...(settingsDto.metadata || {}),
        ...(settingsDto.logoUrl !== undefined ? { logoUrl: settingsDto.logoUrl } : {}),
        ...(settingsDto.signatureSpecimenUrl !== undefined
          ? { signatureSpecimenUrl: settingsDto.signatureSpecimenUrl }
          : {}),
        ...(settingsDto.corporateSealUrl !== undefined
          ? { corporateSealUrl: settingsDto.corporateSealUrl }
          : {}),
      };

      const dataToSave: Prisma.CompanySettingUpdateInput = {
        ...(settingsDto.bankName !== undefined ? { bankName: settingsDto.bankName } : {}),
        ...(settingsDto.bankAccountNumber !== undefined ? { bankAccountNumber: settingsDto.bankAccountNumber } : {}),
        ...(settingsDto.bankAccountName !== undefined ? { bankAccountName: settingsDto.bankAccountName } : {}),
        ...(settingsDto.bankSortCode !== undefined ? { bankSortCode: settingsDto.bankSortCode } : {}),
        ...(settingsDto.showBankDetailsOnInvoice !== undefined ? { showBankDetailsOnInvoice: settingsDto.showBankDetailsOnInvoice } : {}),
        ...(settingsDto.showBankDetailsOnWaybill !== undefined ? { showBankDetailsOnWaybill: settingsDto.showBankDetailsOnWaybill } : {}),
        ...(settingsDto.showBankDetailsOnLetter !== undefined ? { showBankDetailsOnLetter: settingsDto.showBankDetailsOnLetter } : {}),
        ...(settingsDto.defaultPaymentTermsDays !== undefined ? { defaultPaymentTermsDays: settingsDto.defaultPaymentTermsDays } : {}),
        ...(settingsDto.allowSelfApproval !== undefined ? { allowSelfApproval: settingsDto.allowSelfApproval } : {}),
        ...(settingsDto.logoFileId !== undefined ? { logoFileId: settingsDto.logoFileId } : {}),
        ...(settingsDto.stampFileId !== undefined ? { stampFileId: settingsDto.stampFileId } : {}),
        ...(settingsDto.signatureFileId !== undefined ? { signatureFileId: settingsDto.signatureFileId } : {}),
        ...(hasMetaUpdates ? { metadata: mergedMetadata as Prisma.InputJsonValue } : {}),
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
              : new Prisma.Decimal(7.5),
          defaultPaymentTermsDays: settingsDto.defaultPaymentTermsDays ?? 30,
          allowSelfApproval: settingsDto.allowSelfApproval ?? false,
          metadata: hasMetaUpdates
            ? (mergedMetadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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
          newValues: {
            ...settingsDto,
            logoUpdated: Boolean(settingsDto.logoUrl),
            signatureUpdated: Boolean(settingsDto.signatureSpecimenUrl),
            sealUpdated: Boolean(settingsDto.corporateSealUrl),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return this.enrichSettings(result);
    });

    await this.cache?.invalidateTenantNamespace(companyId, 'company');
    this.logger.log(`Company "${companyId}" settings updated by user "${actorId}".`);
    return updatedSettings;
  }

  /**
   * Handles multipart/form-data or data-URI branding asset uploads (`logo`, `signatureSpecimen`, `corporateSeal`).
   * Converts uploaded image buffers into persistent data URIs in `companySetting.metadata` so they render
   * reliably in both Live A4 previews and headless Puppeteer PDFs across container restarts.
   */
  async uploadBrandingAssets(
    companyId: string,
    files: UploadedBrandingFiles = {},
    bodyUrls: {
      logoUrl?: string;
      signatureSpecimenUrl?: string;
      corporateSealUrl?: string;
    } = {},
    actorId: string,
  ) {
    const fileToDataUri = (file?: Express.Multer.File): string | undefined => {
      if (!file || !file.buffer || file.buffer.length === 0) return undefined;

      if (file.buffer.length > MAX_BRANDING_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          'Uploaded branding asset exceeds the maximum allowed size of 2MB.',
        );
      }

      const safeFilename = sanitizeBrandingFilename(file.originalname);
      const ext = path.posix.extname(safeFilename).toLowerCase();
      if (ext && !ALLOWED_BRANDING_EXTENSIONS.has(ext)) {
        throw new BadRequestException(
          `Invalid file extension "${ext}". Only .png, .jpg, and .webp branding images are permitted.`,
        );
      }

      const rawMime = (file.mimetype || '').toLowerCase().trim();
      if (!ALLOWED_BRANDING_MIMES.has(rawMime)) {
        throw new BadRequestException(
          `Unsupported MIME type "${rawMime || 'unknown'}". Only image/png, image/jpeg, and image/webp are permitted.`,
        );
      }

      if (!verifyBrandingMagicBytes(file.buffer, rawMime)) {
        throw new BadRequestException(
          `Branding file "${safeFilename}" failed binary signature (magic bytes) verification for ${rawMime}.`,
        );
      }

      const canonicalMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
      return `data:${canonicalMime};base64,${file.buffer.toString('base64')}`;
    };

    const validateBodyBrandingUrl = (rawUrl?: string): string | undefined => {
      if (rawUrl === undefined) return undefined;
      const trimmed = rawUrl.trim();
      if (!trimmed) return '';
      if (trimmed === DEFAULT_AOA77_LOGO_DATA_URI || trimmed === '/aoa77-logo.svg') {
        return trimmed;
      }
      const dataMatch = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
      if (dataMatch) {
        const declaredMime = dataMatch[1].toLowerCase();
        const decoded = Buffer.from(dataMatch[2], 'base64');
        if (decoded.length > MAX_BRANDING_FILE_SIZE_BYTES) {
          throw new BadRequestException('Branding image data URI exceeds the 2MB maximum size limit.');
        }
        if (!verifyBrandingMagicBytes(decoded, declaredMime)) {
          throw new BadRequestException('Branding image data URI failed binary magic bytes verification.');
        }
        const canonicalMime = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
        return `data:${canonicalMime};base64,${decoded.toString('base64')}`;
      }
      if (/^https:\/\//i.test(trimmed)) {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(trimmed);
        } catch {
          throw new BadRequestException('Malformed external branding URL.');
        }
        const host = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        const isPrivateOrLoopback =
          host === 'localhost' ||
          host === '0.0.0.0' ||
          host === '::1' ||
          host === '169.254.169.254' ||
          host === 'metadata.google.internal' ||
          host.endsWith('.local') ||
          host.endsWith('.internal') ||
          host.endsWith('.localhost') ||
          /^127\./.test(host) ||
          /^10\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^169\.254\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
          /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(host);

        if (parsedUrl.protocol !== 'https:' || isPrivateOrLoopback) {
          throw new BadRequestException(
            'SSRF protection: Branding URL cannot reference private, loopback, or cloud metadata addresses.',
          );
        }
        return parsedUrl.toString();
      }
      throw new BadRequestException(
        'Invalid branding URL. Only verified .png, .jpg, or .webp image uploads or HTTPS URLs are permitted.',
      );
    };

    const logoUrl = fileToDataUri(files.logo?.[0]) ?? validateBodyBrandingUrl(bodyUrls.logoUrl);
    const signatureSpecimenUrl =
      fileToDataUri(files.signatureSpecimen?.[0]) ?? validateBodyBrandingUrl(bodyUrls.signatureSpecimenUrl);
    const corporateSealUrl =
      fileToDataUri(files.corporateSeal?.[0]) ?? validateBodyBrandingUrl(bodyUrls.corporateSealUrl);

    if (
      logoUrl === undefined &&
      signatureSpecimenUrl === undefined &&
      corporateSealUrl === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one branding asset (logo, signatureSpecimen, or corporateSeal).',
      );
    }

    const updated = await this.updateCompanySettings(
      companyId,
      {
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(signatureSpecimenUrl !== undefined ? { signatureSpecimenUrl } : {}),
        ...(corporateSealUrl !== undefined ? { corporateSealUrl } : {}),
      },
      actorId,
    );

    return {
      logoUrl: updated.logoUrl ?? null,
      signatureSpecimenUrl: updated.signatureSpecimenUrl ?? null,
      corporateSealUrl: updated.corporateSealUrl ?? null,
      settings: updated,
    };
  }
}
