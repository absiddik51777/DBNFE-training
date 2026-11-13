export type FileDownloadDestination = 'downloads' | 'cache';

export interface SaveFileOptions {
  /** Desired file name including extension */
  fileName: string;
  /** MIME type of the file */
  mimeType: string;
  /** Base64 encoded binary content (without or with data URI prefix) */
  base64Data: string;
  /** Target destination: 'downloads' (public Downloads folder) or 'cache' (app cache for sharing) */
  destination?: FileDownloadDestination;
}

export interface SaveFileResult {
  success: boolean;
  fileName: string;
  uri: string;
  relativePath: string;
}

export interface StartChunkedSaveOptions {
  fileName: string;
  mimeType: string;
  destination?: FileDownloadDestination;
}

export interface StartChunkedSaveResult {
  uploadId: string;
  fileName: string;
}

export interface AppendChunkOptions {
  uploadId: string;
  base64Chunk: string;
}

export interface FinishChunkedSaveOptions {
  uploadId: string;
}

export interface AbortChunkedSaveOptions {
  uploadId: string;
}

export interface PrintCurrentViewOptions {
  jobName?: string;
  landscape?: boolean;
}

export interface PrintHtmlOptions {
  html: string;
  jobName?: string;
  landscape?: boolean;
}

export interface PrintResult {
  success: boolean;
  jobName: string;
}

export interface FileDownloadPlugin {
  saveFile(options: SaveFileOptions): Promise<SaveFileResult>;
  startChunkedSave(options: StartChunkedSaveOptions): Promise<StartChunkedSaveResult>;
  appendChunk(options: AppendChunkOptions): Promise<{ bytesWritten: number }>;
  finishChunkedSave(options: FinishChunkedSaveOptions): Promise<SaveFileResult>;
  abortChunkedSave(options: AbortChunkedSaveOptions): Promise<void>;
  printCurrentView(options?: PrintCurrentViewOptions): Promise<PrintResult>;
  printHtml(options: PrintHtmlOptions): Promise<PrintResult>;
}
