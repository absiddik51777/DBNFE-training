package com.dbnfe.plugins.filedownload;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "FileDownload",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class FileDownloadPlugin extends Plugin {
    private static final String TAG = "BNFEFileDownload";
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final long TEMP_CLEANUP_AGE_MS = 60 * 60 * 1000L; // 1 hour

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private final Map<String, ChunkSession> activeSessions = new ConcurrentHashMap<>();
    private WebView activePrintWebView;

    private static class ChunkSession {
        final String fileName;
        final String mimeType;
        final String destination;
        final File tempFile;

        ChunkSession(String fileName, String mimeType, String destination, File tempFile) {
            this.fileName = fileName;
            this.mimeType = mimeType;
            this.destination = destination;
            this.tempFile = tempFile;
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (ChunkSession session : activeSessions.values()) {
            if (session.tempFile != null && session.tempFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                session.tempFile.delete();
            }
        }
        activeSessions.clear();
        ioExecutor.shutdown();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String rawFileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String base64Data = call.getString("base64Data");
        String destination = call.getString("destination", "downloads");

        if (rawFileName == null || rawFileName.trim().isEmpty()) {
            call.reject("ফাইলের নাম সঠিক নয় (Invalid file name).", "INVALID_ARGUMENT");
            return;
        }
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("ফাইলের কোনো তথ্য পাওয়া যায়নি (Empty file content).", "INVALID_ARGUMENT");
            return;
        }

        if (requiresLegacyStoragePermission(destination)) {
            requestPermissionForAlias("storage", call, "storagePermsCallback");
            return;
        }

        executeSaveFile(call, rawFileName, mimeType, base64Data, destination);
    }

    @PluginMethod
    public void startChunkedSave(PluginCall call) {
        String rawFileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String destination = call.getString("destination", "downloads");

        if (rawFileName == null || rawFileName.trim().isEmpty()) {
            call.reject("ফাইলের নাম সঠিক নয় (Invalid file name).", "INVALID_ARGUMENT");
            return;
        }

        if (requiresLegacyStoragePermission(destination)) {
            requestPermissionForAlias("storage", call, "storagePermsCallback");
            return;
        }

        executeStartChunkedSave(call, rawFileName, mimeType, destination);
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Downloads ফোল্ডারে সংরক্ষণের জন্য স্টোরেজ অনুমতি (Storage Permission) প্রয়োজন।", "PERMISSION_DENIED");
            return;
        }

        String method = call.getMethodName();
        String rawFileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String destination = call.getString("destination", "downloads");

        if ("startChunkedSave".equals(method)) {
            executeStartChunkedSave(call, rawFileName, mimeType, destination);
        } else {
            String base64Data = call.getString("base64Data", "");
            executeSaveFile(call, rawFileName, mimeType, base64Data, destination);
        }
    }

    private boolean requiresLegacyStoragePermission(String destination) {
        return !"cache".equalsIgnoreCase(destination)
            && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("storage") != PermissionState.GRANTED;
    }

    private void executeSaveFile(
        PluginCall call,
        String rawFileName,
        String mimeType,
        String base64Data,
        String destination
    ) {
        final String safeName = sanitizeFileName(rawFileName);
        final String resolvedMime = (mimeType != null && !mimeType.trim().isEmpty())
            ? mimeType.trim()
            : "application/octet-stream";
        final String dest = "cache".equalsIgnoreCase(destination) ? "cache" : "downloads";

        ioExecutor.execute(() -> {
            try {
                byte[] decoded = decodeBase64Payload(base64Data);
                if (decoded.length == 0) {
                    call.reject("ডিকোড করার পর ফাইলটি খালি পাওয়া গেছে।", "EMPTY_PAYLOAD");
                    return;
                }

                SaveOutcome outcome = "cache".equals(dest)
                    ? saveBytesToCache(decoded, safeName)
                    : saveBytesToPublicDownloads(decoded, safeName, resolvedMime);

                call.resolve(outcome.toJSObject());
            } catch (Exception ex) {
                Log.e(TAG, "Failed to save file: " + safeName, ex);
                call.reject(mapUserFriendlyError(ex), "SAVE_ERROR", ex);
            }
        });
    }

    private void executeStartChunkedSave(
        PluginCall call,
        String rawFileName,
        String mimeType,
        String destination
    ) {
        final String safeName = sanitizeFileName(rawFileName);
        final String resolvedMime = (mimeType != null && !mimeType.trim().isEmpty())
            ? mimeType.trim()
            : "application/octet-stream";
        final String dest = "cache".equalsIgnoreCase(destination) ? "cache" : "downloads";

        ioExecutor.execute(() -> {
            try {
                File stageDir = new File(getContext().getCacheDir(), "export_stage");
                if (!stageDir.exists() && !stageDir.mkdirs()) {
                    call.reject("অস্থায়ী স্টোরেজ ফোল্ডার তৈরি করা যায়নি।", "CACHE_DIR_ERROR");
                    return;
                }
                cleanupOldFiles(stageDir);

                String uploadId = UUID.randomUUID().toString();
                File tempFile = new File(stageDir, uploadId + ".tmp");
                if (tempFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tempFile.delete();
                }

                activeSessions.put(uploadId, new ChunkSession(safeName, resolvedMime, dest, tempFile));

                JSObject res = new JSObject();
                res.put("uploadId", uploadId);
                res.put("fileName", safeName);
                call.resolve(res);
            } catch (Exception ex) {
                Log.e(TAG, "Failed to initialize chunked save", ex);
                call.reject(mapUserFriendlyError(ex), "INIT_ERROR", ex);
            }
        });
    }

    @PluginMethod
    public void appendChunk(PluginCall call) {
        String uploadId = call.getString("uploadId");
        String base64Chunk = call.getString("base64Chunk");

        if (uploadId == null || base64Chunk == null) {
            call.reject("অবৈধ আপলোড সেশন বা ডাটা।", "INVALID_ARGUMENT");
            return;
        }

        ChunkSession session = activeSessions.get(uploadId);
        if (session == null) {
            call.reject("ফাইল রাইটিং সেশন খুঁজে পাওয়া যায়নি।", "SESSION_NOT_FOUND");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                byte[] chunkBytes = decodeBase64Payload(base64Chunk);
                try (FileOutputStream fos = new FileOutputStream(session.tempFile, true)) {
                    fos.write(chunkBytes);
                    fos.flush();
                }
                JSObject res = new JSObject();
                res.put("bytesWritten", chunkBytes.length);
                call.resolve(res);
            } catch (Exception ex) {
                Log.e(TAG, "Failed to append chunk for " + uploadId, ex);
                call.reject(mapUserFriendlyError(ex), "CHUNK_ERROR", ex);
            }
        });
    }

    @PluginMethod
    public void finishChunkedSave(PluginCall call) {
        String uploadId = call.getString("uploadId");
        if (uploadId == null) {
            call.reject("Upload ID missing.", "INVALID_ARGUMENT");
            return;
        }

        ChunkSession session = activeSessions.remove(uploadId);
        if (session == null) {
            call.reject("ফাইল সেভ সেশন বাতিল হয়েছে বা পাওয়া যায়নি।", "SESSION_NOT_FOUND");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                if (!session.tempFile.exists() || session.tempFile.length() == 0) {
                    call.reject("তৈরিকৃত ফাইলটি খালি পাওয়া গেছে।", "EMPTY_FILE");
                    return;
                }

                SaveOutcome outcome = "cache".equals(session.destination)
                    ? copyFileToCache(session.tempFile, session.fileName)
                    : saveFileToPublicDownloads(session.tempFile, session.fileName, session.mimeType);

                call.resolve(outcome.toJSObject());
            } catch (Exception ex) {
                Log.e(TAG, "Failed to finalize chunked save: " + session.fileName, ex);
                call.reject(mapUserFriendlyError(ex), "FINALIZE_ERROR", ex);
            } finally {
                if (session.tempFile != null && session.tempFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    session.tempFile.delete();
                }
            }
        });
    }

    @PluginMethod
    public void abortChunkedSave(PluginCall call) {
        String uploadId = call.getString("uploadId");
        if (uploadId != null) {
            ChunkSession session = activeSessions.remove(uploadId);
            if (session != null && session.tempFile != null && session.tempFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                session.tempFile.delete();
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void printCurrentView(PluginCall call) {
        String jobName = sanitizeFileName(call.getString("jobName", "BNFE Document"));
        boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        Activity activity = getActivity();

        if (activity == null || activity.isFinishing()) {
            call.reject("প্রিন্ট সেবা এখন ব্যবহারযোগ্য নয়।", "UNAVAILABLE");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    call.reject("এই ডিভাইসে Android Print সেবা পাওয়া যায়নি।", "PRINT_UNAVAILABLE");
                    return;
                }
                WebView webView = getBridge().getWebView();
                if (webView == null) {
                    call.reject("প্রিন্ট করার জন্য WebView প্রস্তুত নয়।", "WEBVIEW_UNAVAILABLE");
                    return;
                }

                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                PrintAttributes.Builder attrBuilder = new PrintAttributes.Builder();
                attrBuilder.setMediaSize(
                    landscape ? PrintAttributes.MediaSize.ISO_A4.asLandscape() : PrintAttributes.MediaSize.ISO_A4
                );
                printManager.print(jobName, adapter, attrBuilder.build());

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("jobName", jobName);
                call.resolve(res);
            } catch (Exception ex) {
                Log.e(TAG, "printCurrentView failed", ex);
                call.reject("প্রিন্ট ডায়ালগ খোলা যায়নি: " + ex.getLocalizedMessage(), "PRINT_ERROR", ex);
            }
        });
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        String jobName = sanitizeFileName(call.getString("jobName", "BNFE Report"));
        boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", true));

        if (html == null || html.trim().isEmpty()) {
            call.reject("প্রিন্ট করার জন্য HTML কনটেন্ট পাওয়া যায়নি।", "INVALID_ARGUMENT");
            return;
        }

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            call.reject("প্রিন্ট সেবা এখন ব্যবহারযোগ্য নয়।", "UNAVAILABLE");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    call.reject("এই ডিভাইসে Android Print সেবা পাওয়া যায়নি।", "PRINT_UNAVAILABLE");
                    return;
                }

                WebView webView = new WebView(activity);
                activePrintWebView = webView;
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(false);
                settings.setAllowFileAccess(false);
                settings.setDefaultTextEncodingName("utf-8");

                webView.setWebViewClient(new WebViewClient() {
                    private boolean started = false;

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (started) return;
                        started = true;
                        try {
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            PrintAttributes.Builder attrBuilder = new PrintAttributes.Builder();
                            attrBuilder.setMediaSize(
                                landscape ? PrintAttributes.MediaSize.ISO_A4.asLandscape() : PrintAttributes.MediaSize.ISO_A4
                            );
                            printManager.print(jobName, adapter, attrBuilder.build());

                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("jobName", jobName);
                            call.resolve(res);
                        } catch (Exception ex) {
                            Log.e(TAG, "printHtml onPageFinished failed", ex);
                            call.reject("প্রিন্ট ডায়ালগ খোলা যায়নি: " + ex.getLocalizedMessage(), "PRINT_ERROR", ex);
                        }
                    }
                });

                webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception ex) {
                Log.e(TAG, "printHtml failed", ex);
                call.reject("প্রিন্ট প্রস্তুত করতে ব্যর্থ হয়েছে: " + ex.getLocalizedMessage(), "PRINT_ERROR", ex);
            }
        });
    }

    // =========================================================================
    // STORAGE HELPERS
    // =========================================================================

    private static class SaveOutcome {
        final String fileName;
        final String uri;
        final String relativePath;

        SaveOutcome(String fileName, String uri, String relativePath) {
            this.fileName = fileName;
            this.uri = uri;
            this.relativePath = relativePath;
        }

        JSObject toJSObject() {
            JSObject obj = new JSObject();
            obj.put("success", true);
            obj.put("fileName", fileName);
            obj.put("uri", uri);
            obj.put("relativePath", relativePath);
            return obj;
        }
    }

    private SaveOutcome saveBytesToCache(byte[] data, String fileName) throws IOException {
        ensureStorageAvailable(getContext().getCacheDir(), data.length);
        File shareDir = new File(getContext().getCacheDir(), "shared_exports");
        if (!shareDir.exists() && !shareDir.mkdirs()) {
            throw new IOException("Could not create cache export directory");
        }
        cleanupOldFiles(shareDir);

        File target = new File(shareDir, fileName);
        if (target.exists()) {
            //noinspection ResultOfMethodCallIgnored
            target.delete();
        }
        try (FileOutputStream fos = new FileOutputStream(target)) {
            fos.write(data);
            fos.flush();
        }
        return new SaveOutcome(fileName, Uri.fromFile(target).toString(), "cache/" + fileName);
    }

    private SaveOutcome copyFileToCache(File srcFile, String fileName) throws IOException {
        ensureStorageAvailable(getContext().getCacheDir(), srcFile.length());
        File shareDir = new File(getContext().getCacheDir(), "shared_exports");
        if (!shareDir.exists() && !shareDir.mkdirs()) {
            throw new IOException("Could not create cache export directory");
        }
        cleanupOldFiles(shareDir);

        File target = new File(shareDir, fileName);
        if (target.exists()) {
            //noinspection ResultOfMethodCallIgnored
            target.delete();
        }
        try (InputStream in = new BufferedInputStream(new FileInputStream(srcFile));
             OutputStream out = new FileOutputStream(target)) {
            copyStream(in, out);
        }
        return new SaveOutcome(fileName, Uri.fromFile(target).toString(), "cache/" + fileName);
    }

    private SaveOutcome saveBytesToPublicDownloads(byte[] data, String desiredName, String mimeType) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return saveStreamToMediaStore(null, data, desiredName, mimeType);
        } else {
            return saveStreamToLegacyDownloads(null, data, desiredName, mimeType);
        }
    }

    private SaveOutcome saveFileToPublicDownloads(File srcFile, String desiredName, String mimeType) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return saveStreamToMediaStore(srcFile, null, desiredName, mimeType);
        } else {
            return saveStreamToLegacyDownloads(srcFile, null, desiredName, mimeType);
        }
    }

    private SaveOutcome saveStreamToMediaStore(
        File srcFile,
        byte[] rawBytes,
        String desiredName,
        String mimeType
    ) throws IOException {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            throw new IOException("MediaStore.Downloads requires Android 10+");
        }

        long requiredBytes = srcFile != null ? srcFile.length() : (rawBytes != null ? rawBytes.length : 0L);
        File downloadsProbe = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        ensureStorageAvailable(downloadsProbe != null && downloadsProbe.exists() ? downloadsProbe : getContext().getCacheDir(), requiredBytes);

        ContentResolver resolver = getContext().getContentResolver();
        String uniqueName = resolveUniqueMediaStoreName(resolver, desiredName);

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, uniqueName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("MediaStore insert returned null URI for " + uniqueName);
        }

        boolean completed = false;
        try {
            try (OutputStream out = resolver.openOutputStream(uri, "w")) {
                if (out == null) {
                    throw new IOException("ContentResolver failed to open output stream");
                }
                if (srcFile != null) {
                    try (InputStream in = new BufferedInputStream(new FileInputStream(srcFile))) {
                        copyStream(in, out);
                    }
                } else if (rawBytes != null) {
                    out.write(rawBytes);
                    out.flush();
                }
            }

            ContentValues publishValues = new ContentValues();
            publishValues.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, publishValues, null, null);
            completed = true;

            return new SaveOutcome(
                uniqueName,
                uri.toString(),
                Environment.DIRECTORY_DOWNLOADS + "/" + uniqueName
            );
        } finally {
            if (!completed) {
                try {
                    resolver.delete(uri, null, null);
                } catch (Exception deleteErr) {
                    Log.w(TAG, "Failed to clean up aborted MediaStore entry", deleteErr);
                }
            }
        }
    }

    @SuppressWarnings("deprecation")
    private SaveOutcome saveStreamToLegacyDownloads(
        File srcFile,
        byte[] rawBytes,
        String desiredName,
        String mimeType
    ) throws IOException {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDir == null) {
            throw new IOException("Downloads directory is unavailable");
        }
        if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
            throw new IOException("Failed to create Downloads directory");
        }

        long requiredBytes = srcFile != null ? srcFile.length() : (rawBytes != null ? rawBytes.length : 0L);
        ensureStorageAvailable(downloadsDir, requiredBytes);

        File targetFile = resolveUniqueLegacyFile(downloadsDir, desiredName);
        boolean completed = false;
        try {
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                if (srcFile != null) {
                    try (InputStream in = new BufferedInputStream(new FileInputStream(srcFile))) {
                        copyStream(in, fos);
                    }
                } else if (rawBytes != null) {
                    fos.write(rawBytes);
                    fos.flush();
                }
                try {
                    fos.getFD().sync();
                } catch (Exception ignored) {
                    // Some filesystems do not support fsync
                }
            }
            completed = true;

            MediaScannerConnection.scanFile(
                getContext(),
                new String[]{ targetFile.getAbsolutePath() },
                new String[]{ mimeType },
                null
            );

            return new SaveOutcome(
                targetFile.getName(),
                Uri.fromFile(targetFile).toString(),
                Environment.DIRECTORY_DOWNLOADS + "/" + targetFile.getName()
            );
        } finally {
            if (!completed && targetFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                targetFile.delete();
            }
        }
    }

    private String resolveUniqueMediaStoreName(ContentResolver resolver, String desiredName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return desiredName;

        int dotIdx = desiredName.lastIndexOf('.');
        String baseName = dotIdx > 0 ? desiredName.substring(0, dotIdx) : desiredName;
        String ext = dotIdx > 0 ? desiredName.substring(dotIdx) : "";

        Set<String> existingLower = new HashSet<>();
        String[] projection = new String[] { MediaStore.MediaColumns.DISPLAY_NAME };
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + " = ? OR " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        String[] selectionArgs = new String[] { desiredName, baseName + " (%" + ext };

        try (Cursor cursor = resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            null
        )) {
            if (cursor != null) {
                int nameCol = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
                while (nameCol >= 0 && cursor.moveToNext()) {
                    String existing = cursor.getString(nameCol);
                    if (existing != null) {
                        existingLower.add(existing.toLowerCase(Locale.ROOT));
                    }
                }
            }
        } catch (Exception queryErr) {
            Log.w(TAG, "MediaStore query check failed, proceeding with desired name", queryErr);
        }

        if (!existingLower.contains(desiredName.toLowerCase(Locale.ROOT))) {
            return desiredName;
        }

        for (int i = 1; i < 1000; i++) {
            String candidate = baseName + " (" + i + ")" + ext;
            if (!existingLower.contains(candidate.toLowerCase(Locale.ROOT))) {
                return candidate;
            }
        }
        return baseName + "_" + System.currentTimeMillis() + ext;
    }

    private File resolveUniqueLegacyFile(File dir, String desiredName) {
        File candidate = new File(dir, desiredName);
        if (!candidate.exists()) {
            return candidate;
        }
        int dotIdx = desiredName.lastIndexOf('.');
        String baseName = dotIdx > 0 ? desiredName.substring(0, dotIdx) : desiredName;
        String ext = dotIdx > 0 ? desiredName.substring(dotIdx) : "";

        for (int i = 1; i < 1000; i++) {
            File next = new File(dir, baseName + " (" + i + ")" + ext);
            if (!next.exists()) {
                return next;
            }
        }
        return new File(dir, baseName + "_" + System.currentTimeMillis() + ext);
    }

    private void ensureStorageAvailable(File probeDir, long requiredBytes) throws IOException {
        if (requiredBytes <= 0 || probeDir == null) return;
        try {
            File checkPath = probeDir.exists() ? probeDir : getContext().getCacheDir();
            StatFs stat = new StatFs(checkPath.getAbsolutePath());
            long availableBytes = stat.getAvailableBytes();
            if (availableBytes > 0 && availableBytes < requiredBytes + (512 * 1024L)) {
                throw new IOException("ENOSPC: ডিভাইসে পর্যাপ্ত স্টোরেজ জায়গা খালি নেই (Insufficient storage space)।");
            }
        } catch (IOException ioe) {
            throw ioe;
        } catch (Exception ignored) {
            // Ignore StatFs probe issues on exotic filesystems; actual write will validate
        }
    }

    private static void copyStream(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }

    private static byte[] decodeBase64Payload(String base64Input) {
        String clean = base64Input;
        int commaIdx = clean.indexOf(',');
        if (clean.startsWith("data:") && commaIdx != -1) {
            clean = clean.substring(commaIdx + 1);
        }
        return Base64.decode(clean, Base64.DEFAULT);
    }

    private static String sanitizeFileName(String rawName) {
        if (rawName == null) return "export_" + System.currentTimeMillis();
        String cleaned = rawName.trim()
            .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_")
            .replaceAll("^\\.+", "");
        if (cleaned.isEmpty()) {
            return "export_" + System.currentTimeMillis();
        }
        if (cleaned.length() > 140) {
            int dotIdx = cleaned.lastIndexOf('.');
            if (dotIdx > 0 && dotIdx > cleaned.length() - 12) {
                String ext = cleaned.substring(dotIdx);
                cleaned = cleaned.substring(0, 140 - ext.length()) + ext;
            } else {
                cleaned = cleaned.substring(0, 140);
            }
        }
        return cleaned;
    }

    private static void cleanupOldFiles(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - TEMP_CLEANUP_AGE_MS;
        for (File f : files) {
            if (f.isFile() && f.lastModified() < cutoff) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    private static String mapUserFriendlyError(Exception ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "";
        if (msg.contains("ENOSPC") || msg.toLowerCase(Locale.ROOT).contains("no space") || msg.contains("স্টোরেজ")) {
            return "ডিভাইসে পর্যাপ্ত স্টোরেজ খালি নেই। কিছু ফাইল মুছে আবার চেষ্টা করুন।";
        }
        if (msg.toLowerCase(Locale.ROOT).contains("permission") || ex instanceof SecurityException) {
            return "ফাইল সংরক্ষণের অনুমতি পাওয়া যায়নি। অ্যাপের স্টোরেজ অনুমতি যাচাই করুন।";
        }
        return "ফাইল সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।";
    }
}
