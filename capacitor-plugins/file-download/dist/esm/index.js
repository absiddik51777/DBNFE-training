import { registerPlugin } from '@capacitor/core';

const FileDownload = registerPlugin('FileDownload', {
  web: () => import('./web.js').then((m) => new m.FileDownloadWeb()),
});

export { FileDownload };
