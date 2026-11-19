package app.lovable.logogridstudio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Android Storage Access Framework: no broad storage permission required. */
@CapacitorPlugin(name = "NativeDocuments")
public class NativeDocumentsPlugin extends Plugin {
    private static final int MAX_SAVE_BYTES = 32 * 1024 * 1024;
    private static final int MAX_OPEN_BYTES = 24 * 1024 * 1024;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType");
        String base64 = call.getString("base64");
        if (filename == null || !filename.matches("[a-zA-Z0-9._-]{1,100}")
                || mimeType == null || !(mimeType.equals("image/png")
                    || mimeType.equals("image/svg+xml") || mimeType.equals("application/json"))
                || base64 == null || base64.length() > ((MAX_SAVE_BYTES * 4L / 3L) + 16L)) {
            call.reject("Invalid filename, MIME type or file size");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onSaveFile");
    }

    @ActivityCallback
    private void onSaveFile(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        try {
            byte[] bytes = Base64.decode(call.getString("base64"), Base64.DEFAULT);
            if (bytes.length > MAX_SAVE_BYTES) {
                call.reject("File exceeds 32 MiB limit");
                return;
            }
            Uri uri = result.getData().getData();
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (stream == null) throw new java.io.IOException("Document is not writable");
                stream.write(bytes);
                stream.flush();
            }
            JSObject response = new JSObject();
            response.put("saved", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not save document", error);
        }
    }

    @PluginMethod
    public void openProject(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Android providers may report custom MIME types for .logo files.
        // The JavaScript .logo parser independently validates file contents.
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, "onOpenProject");
    }

    @ActivityCallback
    private void onOpenProject(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        try (InputStream stream = getContext().getContentResolver().openInputStream(result.getData().getData());
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (stream == null) throw new java.io.IOException("Document is not readable");
            byte[] buffer = new byte[8192];
            int n;
            while ((n = stream.read(buffer)) != -1) {
                if (bytes.size() + n > MAX_OPEN_BYTES) {
                    call.reject("Project exceeds 24 MiB limit");
                    return;
                }
                bytes.write(buffer, 0, n);
            }
            JSObject response = new JSObject();
            response.put("content", new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not open document", error);
        }
    }
}
