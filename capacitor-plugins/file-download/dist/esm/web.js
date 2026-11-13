import { WebPlugin } from '@capacitor/core';

export class FileDownloadWeb extends WebPlugin {
  async saveFile() {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }
  async startChunkedSave() {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }
  async appendChunk() {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }
  async finishChunkedSave() {
    throw this.unimplemented('Native FileDownload is only used on Android/iOS.');
  }
  async abortChunkedSave() {
    return;
  }
  async printCurrentView(options) {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
    return { success: true, jobName: options?.jobName || 'Document' };
  }
  async printHtml() {
    throw this.unimplemented('printHtml native method is only used on Android.');
  }
}
