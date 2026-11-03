export interface DownloadDocumentPdfOptions {
  documentId: string;
  documentNumber?: string | null;
  documentType?: string;
  isPreview?: boolean;
}

/**
 * In standalone portfolio demo mode, triggers the browser's native print-to-PDF
 * dialog to produce pixel-perfect A4 documents directly on the client.
 */
export async function downloadDocumentPdf({
  documentId: _documentId,
  documentNumber: _documentNumber,
  documentType: _documentType = 'document',
}: DownloadDocumentPdfOptions): Promise<void> {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

/**
 * Opens print preview in the browser.
 */
export async function printDocumentPdf(_documentId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
