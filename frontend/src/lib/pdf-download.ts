import { apiClient } from './api-client';

export interface DownloadDocumentPdfOptions {
  documentId: string;
  documentNumber?: string | null;
  documentType?: string;
  isPreview?: boolean;
}

/**
 * Downloads a generated PDF directly as a file to the user's device.
 * Triggers an authenticated API request with responseType: 'blob',
 * creates an object URL, creates a virtual anchor element with download="filename.pdf",
 * programmatically clicks it to trigger the file download, and cleans up the object URL.
 */
export async function downloadDocumentPdf({
  documentId,
  documentNumber,
  documentType = 'document',
  isPreview = false,
}: DownloadDocumentPdfOptions): Promise<void> {
  const endpoint = isPreview
    ? `/documents/${documentId}/preview-pdf`
    : `/documents/${documentId}/pdf`;

  const response = await apiClient.get(endpoint, {
    responseType: 'blob',
    params: { download: 'true' },
  });

  const rawFilename =
    documentNumber?.trim() || `${documentType.toLowerCase()}_${documentId.slice(0, 8)}`;
  const cleanFilename = rawFilename.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = cleanFilename.toLowerCase().endsWith('.pdf')
    ? cleanFilename
    : `${cleanFilename}.pdf`;

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup DOM and memory
  document.body.removeChild(anchor);
  setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 1000);
}

/**
 * Opens the document PDF in a new browser tab for immediate viewing/printing.
 */
export async function printDocumentPdf(documentId: string): Promise<void> {
  const response = await apiClient.get(`/documents/${documentId}/pdf`, {
    responseType: 'blob',
    params: { download: 'false' },
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}
