import { WebPlugin } from '@capacitor/core';
import type {
  FileDownloadPlugin,
  SaveFileOptions,
  SaveFileResult,
  StartChunkedSaveOptions,
  StartChunkedSaveResult,
  AppendChunkOptions,
  FinishChunkedSaveOptions,
  AbortChunkedSaveOptions,
  PrintCurrentViewOptions,
  PrintHtmlOptions,
  PrintResult
} from './definitions';

export class FileDownloadWeb extends WebPlugin implements FileDownloadPlugin {
  async saveFile(_options: SaveFileOptions): Promise<SaveFileResult> {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }

  async startChunkedSave(_options: StartChunkedSaveOptions): Promise<StartChunkedSaveResult> {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }

  async appendChunk(_options: AppendChunkOptions): Promise<{ bytesWritten: number }> {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }

  async finishChunkedSave(_options: FinishChunkedSaveOptions): Promise<SaveFileResult> {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }

  async abortChunkedSave(_options: AbortChunkedSaveOptions): Promise<void> {
    return;
  }

  async printCurrentView(_options?: PrintCurrentViewOptions): Promise<PrintResult> {
    window.print();
    return { success: true, jobName: _options?.jobName || 'Document' };
  }

  async printHtml(_options: PrintHtmlOptions): Promise<PrintResult> {
    throw this.unimplemented('printHtml native method is only used on Android.');
  }
}
