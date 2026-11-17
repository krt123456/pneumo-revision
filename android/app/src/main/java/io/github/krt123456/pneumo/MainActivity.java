package io.github.krt123456.pneumo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Pneumo Révision : le site de révision, embarqué dans l'application (fonctionne sans Internet).
 * Les fichiers du site sont servis depuis les assets par WebViewAssetLoader, sur une adresse https stable,
 * pour que le stockage du navigateur (localStorage) soit conservé d'une ouverture à l'autre.
 * La progression est aussi copiée dans un fichier interne (pont PneumoNative), relu si le stockage web est vide.
 */
public class MainActivity extends Activity {
    private static final String TAG = "PneumoApp";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final String SITE = "https://krt123456.github.io/pneumo-revision/";
    private static final String STATE = "pneumo-state.json";
    private static final int REQ_OPEN = 41;
    private static final int REQ_SAVE = 42;

    private WebView web;
    private WebViewAssetLoader loader;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSave;
    private final Object lock = new Object();

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        Intent it = getIntent();
        if (debuggable || (it != null && it.getBooleanExtra("devtools", false))) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.bg));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " PneumoRevisionApp/" + BuildConfig.VERSION_NAME);

        web.addJavascriptInterface(new Bridge(), "PneumoNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                toast("Utilise le bouton « Exporter » des réglages");
                return;
            }
            openExternal(toSiteUrl(Uri.parse(url)));
        });

        if (saved == null || web.restoreState(saved) == null) {
            web.loadUrl(START);
        }
    }

    /** Adresse publique (GitHub Pages) d'un fichier du site embarqué : PDF, APK… s'ouvrent dans le navigateur. */
    private String toSiteUrl(Uri u) {
        if (u != null && HOST.equals(u.getHost())) {
            String p = u.getPath() == null ? "" : u.getPath();
            return SITE + p.replaceFirst("^/assets/www/", "");
        }
        return u == null ? SITE : u.toString();
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            toast("Impossible d'ouvrir ce lien");
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    /* ---------- copie de la progression dans un fichier interne (écriture atomique) ---------- */
    private boolean writeState(String json) {
        if (json == null || json.isEmpty()) return false;
        synchronized (lock) {
            File dir = getFilesDir();
            File tmp = new File(dir, STATE + ".tmp");
            File dst = new File(dir, STATE);
            try (FileOutputStream os = new FileOutputStream(tmp)) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
                os.flush();
                os.getFD().sync();
            } catch (Exception e) {
                Log.e(TAG, "écriture impossible", e);
                return false;
            }
            if (!tmp.renameTo(dst)) {
                Log.e(TAG, "renommage impossible");
                return false;
            }
            return true;
        }
    }

    private String readState() {
        synchronized (lock) {
            File f = new File(getFilesDir(), STATE);
            if (!f.exists()) return "";
            try (FileInputStream in = new FileInputStream(f)) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                return new String(bo.toByteArray(), StandardCharsets.UTF_8);
            } catch (Exception e) {
                Log.e(TAG, "lecture impossible", e);
                return "";
            }
        }
    }

    private void applyBars(String status, String nav, boolean lightNav) {
        try {
            Window w = getWindow();
            w.setStatusBarColor(Color.parseColor(status));
            w.setNavigationBarColor(Color.parseColor(nav));
            if (Build.VERSION.SDK_INT >= 30) {
                WindowInsetsController c = w.getInsetsController();
                if (c != null) {
                    c.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                    c.setSystemBarsAppearance(lightNav ? WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0,
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                }
            } else if (Build.VERSION.SDK_INT >= 26) {
                View d = w.getDecorView();
                int f = d.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                f = lightNav ? (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                d.setSystemUiVisibility(f);
            }
        } catch (Exception e) {
            Log.w(TAG, "couleurs des barres", e);
        }
    }

    /* ---------- pont JavaScript : window.PneumoNative ---------- */
    private class Bridge {
        @JavascriptInterface
        public boolean store(String json) {
            return writeState(json);
        }

        @JavascriptInterface
        public String restore() {
            return readState();
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME + "|" + BuildConfig.VERSION_CODE;
        }

        @JavascriptInterface
        public void openExternal(String url) {
            runOnUiThread(() -> MainActivity.this.openExternal(url));
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title);
                i.putExtra(Intent.EXTRA_TEXT, text);
                try {
                    startActivity(Intent.createChooser(i, title));
                } catch (Exception e) {
                    MainActivity.this.toast("Partage impossible");
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String content) {
            runOnUiThread(() -> {
                pendingSave = content;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "application/json" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingSave = null;
                    shareText(name, content);
                }
            });
        }

        @JavascriptInterface
        public void setBars(String status, String nav, boolean lightNav) {
            runOnUiThread(() -> applyBars(status, nav, lightNav));
        }

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() -> MainActivity.this.toast(msg));
        }
    }

    /* ---------- navigation ---------- */
    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return loader.shouldInterceptRequest(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) {
                String p = u.getPath() == null ? "" : u.getPath();
                if (p.endsWith(".pdf") || p.endsWith(".apk")) {
                    openExternal(toSiteUrl(u));
                    return true;
                }
                return false;
            }
            openExternal(u.toString());
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            Log.w(TAG, "moteur web arrêté, on relance");
            if (web != null) {
                ViewGroup parent = (ViewGroup) web.getParent();
                if (parent != null) parent.removeView(web);
                web.destroy();
                web = null;
            }
            recreate();
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            try {
                startActivityForResult(i, REQ_OPEN);
            } catch (ActivityNotFoundException e) {
                try {
                    Intent g = new Intent(Intent.ACTION_GET_CONTENT);
                    g.addCategory(Intent.CATEGORY_OPENABLE);
                    g.setType("*/*");
                    startActivityForResult(Intent.createChooser(g, "Choisir le fichier"), REQ_OPEN);
                } catch (Exception e2) {
                    fileCallback = null;
                    toast("Aucune application pour choisir un fichier");
                    return false;
                }
            }
            return true;
        }

        @Override
        public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("OK", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("OK", (d, w) -> result.confirm())
                    .setNegativeButton("Annuler", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            int level = m.messageLevel() == ConsoleMessage.MessageLevel.ERROR ? Log.ERROR : Log.INFO;
            Log.println(level, "PneumoJS", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }
    }

    /* ---------- cycle de vie ---------- */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_OPEN) {
            Uri[] r = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
            if (fileCallback != null) fileCallback.onReceiveValue(r);
            fileCallback = null;
        } else if (requestCode == REQ_SAVE) {
            String content = pendingSave;
            pendingSave = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && content != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (os == null) throw new IllegalStateException("flux indisponible");
                    os.write(content.getBytes(StandardCharsets.UTF_8));
                    toast("Progression exportée ✓");
                } catch (Exception e) {
                    Log.e(TAG, "export", e);
                    toast("Échec de l'export");
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.PNEUMO&&PNEUMO.flush&&PNEUMO.flush()", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
