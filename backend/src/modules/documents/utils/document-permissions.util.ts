import { ForbiddenException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export type DocumentAction =
  | 'view'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'archive'
  | 'duplicate'
  | 'version'
  | 'issue';

/**
 * Maps generic /documents actions to the seeded, type-specific permission slugs.
 *
 * Where the seed has no dedicated slug, the closest stricter permission is used (marked ⚠):
 *  - waybill/letter submit   -> *:update   (no *:submit slug seeded)
 *  - waybill archive         -> waybill:cancel  (no waybill:archive slug seeded)
 *  - letter cancel           -> letter:approve  (no letter:cancel slug seeded)
 */
export const DOCUMENT_PERMISSION_MATRIX: Record<DocumentType, Record<DocumentAction, string>> = {
  [DocumentType.INVOICE]: {
    view: 'invoice:view',
    submit: 'invoice:submit',
    approve: 'invoice:approve',
    reject: 'invoice:approve',
    cancel: 'invoice:cancel',
    archive: 'invoice:archive',
    duplicate: 'invoice:create',
    version: 'invoice:update',
    issue: 'invoice:issue',
  },
  [DocumentType.WAYBILL]: {
    view: 'waybill:view',
    submit: 'waybill:update', // ⚠
    approve: 'waybill:approve',
    reject: 'waybill:approve',
    cancel: 'waybill:cancel',
    archive: 'waybill:cancel', // ⚠
    duplicate: 'waybill:create',
    version: 'waybill:update',
    issue: 'waybill:dispatch',
  },
  [DocumentType.LETTER]: {
    view: 'letter:view',
    submit: 'letter:update', // ⚠
    approve: 'letter:approve',
    reject: 'letter:approve',
    cancel: 'letter:approve', // ⚠
    archive: 'letter:archive',
    duplicate: 'letter:create',
    version: 'letter:update',
    issue: 'letter:issue',
  },
};

/** Same Admin override semantics as PermissionsGuard. */
export function hasDocumentPermission(
  user: AuthenticatedUser,
  documentType: DocumentType,
  action: DocumentAction,
): boolean {
  if (user.role === 'Admin') return true;
  if (!Array.isArray(user.permissions)) return false;
  if (user.permissions.includes('*') || user.permissions.includes('*:*')) return true;

  const required = DOCUMENT_PERMISSION_MATRIX[documentType][action];
  if (user.permissions.includes(required)) return true;

  const [domain] = required.split(':');
  if (user.permissions.includes(`${domain}:manage`) || user.permissions.includes(`${domain}:*`)) return true;

  return false;
}

export function assertDocumentPermission(
  user: AuthenticatedUser,
  documentType: DocumentType,
  action: DocumentAction,
): void {
  if (!hasDocumentPermission(user, documentType, action)) {
    throw new ForbiddenException(
      `Access denied. You lack the required permission: [${DOCUMENT_PERMISSION_MATRIX[documentType][action]}]`,
    );
  }
}

/** Document types the user may list/view. */
export function viewableDocumentTypes(user: AuthenticatedUser): DocumentType[] {
  return (Object.values(DocumentType) as DocumentType[]).filter((t) => hasDocumentPermission(user, t, 'view'));
}
