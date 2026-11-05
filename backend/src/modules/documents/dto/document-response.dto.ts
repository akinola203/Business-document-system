import { Exclude, Expose } from 'class-transformer';
import { DocumentStatus, DocumentType } from '@prisma/client';

export class DocumentResponseDto {
  @Expose()
  id!: string;

  @Expose()
  companyId!: string;

  @Expose()
  documentNumber!: string;

  @Expose()
  documentType!: DocumentType;

  @Expose()
  title!: string;

  @Expose()
  status!: DocumentStatus;

  @Expose()
  issueDate!: Date;

  @Expose()
  dueDate?: Date | null;

  @Expose()
  currency!: string;

  @Expose()
  subtotal!: string | number;

  @Expose()
  taxAmount!: string | number;

  @Expose()
  discountAmount!: string | number;

  @Expose()
  totalAmount!: string | number;

  @Expose()
  balanceDue!: string | number;

  @Expose()
  versionCounter!: number;

  @Expose()
  clientId?: string | null;

  @Expose()
  branchId?: string | null;

  @Expose()
  departmentId?: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  // Sensitive Internal Fields Protected by @Exclude()
  @Exclude()
  deletedAt?: Date | null;

  @Exclude()
  internalAuditMetadata?: any;

  @Exclude()
  internalSecret?: string;

  @Exclude()
  internalNotes?: string;

  @Exclude()
  auditLogs?: any[];

  constructor(partial: Partial<DocumentResponseDto>) {
    Object.assign(this, partial);
  }
}

