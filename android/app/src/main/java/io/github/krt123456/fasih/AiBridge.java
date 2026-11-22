package io.github.krt123456.fasih;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.util.Base64;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.KeyStore;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Everything that connects Fasih to AI tutors:
 * 1) hand-off to the learner's own AI app (share text and photo, clipboard, text shared back into Fasih);
 * 2) photos taken or picked inside Fasih (scaled copies in cache/shots);
 * 3) optional API mode: the learner's own API keys, encrypted with the Android Keystore, and a small HTTPS
 *    transport that can only reach the four provider hosts below. Keys never reach the web page.
 */
final class AiBridge {
    private static final String TAG = "FasihAI";
    static final int REQ_CAM = 61;
    static final int REQ_PICK = 62;
    private static final int TEXT_MAX = 300_000;
    private static final int SEND_MAX = 60_000;
    private static final int MAX_SIDE = 1568;
    private static final String PREFS = "fasih_ai";
    private static final String KS_ALIAS = "fasih_ai_keys";
    private static final String CAP_NAME = "cap.tmp.jpg";

    /** key, Android package, website, display name, API host, authentication header ("bearer" = Authorization: Bearer). */
    private static final String[][] APPS = {
            {"claude", "com.anthropic.claude", "https://claude.ai/new", "Claude", "api.anthropic.com", "x-api-key"},
            {"chatgpt", "com.openai.chatgpt", "https://chatgpt.com/", "ChatGPT", "api.openai.com", "bearer"},
            {"gemini", "com.google.android.apps.bard", "https://gemini.google.com/app", "Gemini", "generativelanguage.googleapis.com", "x-goog-api-key"},
            {"grok", "ai.x.grok", "https://grok.com/", "Grok", "api.x.ai", "bearer"},
    };
    private static final Pattern PATH = Pattern.compile("^/v1(beta)?/[A-Za-z0-9_.:/\\-]+(\\?[A-Za-z0-9_=&.\\-]*)?$");
    private static final Pattern IMG = Pattern.compile("@@IMG:([A-Za-z0-9]{1,24})@@");
    private static final Pattern IMG_ID = Pattern.compile("^[A-Za-z0-9]{1,24}$");

    private final MainActivity act;
    private final ClipboardManager clipboard;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);
    private final Map<String, HttpURLConnection> live = new ConcurrentHashMap<>();
    private final Set<String> cancelled = ConcurrentHashMap.newKeySet();
    private volatile String pendingShare = "";

    AiBridge(MainActivity activity) {
        act = activity;
        clipboard = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
        File dir = shotsDir();
        File[] old = dir.listFiles();
        long limit = System.currentTimeMillis() - 14L * 24 * 3600 * 1000;
        if (old != null) {
            for (File f : old) {
                if (f.isFile() && f.lastModified() < limit) f.delete();
            }
        }
    }

    void shutdown() {
        pool.shutdownNow();
    }

    private static String[] find(String key) {
        for (String[] a : APPS) if (a[0].equals(key)) return a;
        return null;
    }

    private void toast(final String msg) {
        act.runOnUiThread(() -> Toast.makeText(act, msg, Toast.LENGTH_LONG).show());
    }

    /* ---------- text shared into Fasih from another app ---------- */

    /** Remembers text sent to Fasih by ACTION_SEND or ACTION_PROCESS_TEXT. Returns true if there is some. */
    boolean readIntent(Intent it, boolean fresh) {
        if (it == null || !fresh) return false;
        if ((it.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return false;
        String a = it.getAction();
        CharSequence t = null;
        try {
            if (Intent.ACTION_SEND.equals(a)) t = it.getCharSequenceExtra(Intent.EXTRA_TEXT);
            else if (Intent.ACTION_PROCESS_TEXT.equals(a)) t = it.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
        } catch (Exception e) {
            Log.w(TAG, "shared text", e);
        }
        if (t == null || t.length() == 0) return false;
        String s = t.toString();
        pendingShare = s.length() > TEXT_MAX ? s.substring(0, TEXT_MAX) : s;
        return true;
    }

    String takeShared() {
        String s = pendingShare;
        pendingShare = "";
        return s == null ? "" : s;
    }

    /* ---------- clipboard ---------- */

    boolean copy(String text) {
        try {
            if (clipboard == null || text == null) return false;
            clipboard.setPrimaryClip(ClipData.newPlainText("Fasih", text));
            return true;
        } catch (Exception e) {
            Log.w(TAG, "copy", e);
            return false;
        }
    }

    String paste() {
        try {
            if (clipboard == null || !clipboard.hasPrimaryClip()) return "";
            ClipData c = clipboard.getPrimaryClip();
            if (c == null || c.getItemCount() == 0) return "";
            CharSequence t = c.getItemAt(0).coerceToText(act);
            if (t == null) return "";
            String s = t.toString();
            return s.length() > TEXT_MAX ? s.substring(0, TEXT_MAX) : s;
        } catch (Exception e) {
            Log.w(TAG, "paste", e);
            return "";
        }
    }

    /* ---------- hand-off to the learner's AI app ---------- */

    private static Intent textIntent(String pkg, String text) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, text);
        if (pkg != null) i.setPackage(pkg);
        return i;
    }

    private static Intent imageIntent(String pkg, Uri uri, String text) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("image/jpeg");
        if (uri != null) {
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.setClipData(ClipData.newRawUri("Fasih", uri));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        if (text != null) i.putExtra(Intent.EXTRA_TEXT, text);
        if (pkg != null) i.setPackage(pkg);
        return i;
    }

    /** {"claude":{"inst":true,"send":true,"img":true},...} */
    String apps() {
        JSONObject o = new JSONObject();
        PackageManager pm = act.getPackageManager();
        for (String[] a : APPS) {
            boolean inst = false, send = false, img = false;
            try {
                inst = pm.getLaunchIntentForPackage(a[1]) != null;
                send = inst && textIntent(a[1], "x").resolveActivity(pm) != null;
                img = inst && imageIntent(a[1], null, null).resolveActivity(pm) != null;
            } catch (Exception e) {
                Log.w(TAG, "apps", e);
            }
            try {
                o.put(a[0], new JSONObject().put("inst", inst).put("send", send).put("img", img));
            } catch (JSONException ignored) {
            }
        }
        return o.toString();
    }

    /**
     * Opens the chosen AI app with the request (and the photo if any). The text is always copied to the clipboard too.
     * Returns send | sendimg | copy | web | chooser | fail.
     */
    String send(String key, String textIn, String img) {
        if (textIn == null || textIn.isEmpty()) return "fail";
        final String text = textIn.length() > SEND_MAX ? textIn.substring(0, SEND_MAX) : textIn;
        final boolean copied = copy(text);
        Uri uri = null;
        try {
            File f = imageFile(img);
            if (f != null) uri = uriFor(f);
        } catch (Exception e) {
            Log.w(TAG, "photo uri", e);
        }
        final PackageManager pm = act.getPackageManager();
        final String[] app = find(key);
        Intent go;
        String how;
        try {
            if (app == null) {
                go = Intent.createChooser(uri != null ? imageIntent(null, uri, text) : textIntent(null, text), "أرسل إلى");
                how = "chooser";
            } else {
                Intent launch = pm.getLaunchIntentForPackage(app[1]);
                if (launch == null) {
                    if (uri != null) {
                        go = Intent.createChooser(imageIntent(null, uri, text), "أرسل إلى");
                        how = "chooser";
                    } else {
                        go = new Intent(Intent.ACTION_VIEW, Uri.parse(app[2]));
                        how = "web";
                    }
                } else if (uri != null) {
                    Intent si = imageIntent(app[1], uri, text);
                    if (si.resolveActivity(pm) != null) {
                        go = si;
                        how = "sendimg";
                    } else {
                        go = Intent.createChooser(imageIntent(null, uri, text), "أرسل إلى");
                        how = "chooser";
                    }
                } else {
                    Intent st = textIntent(app[1], text);
                    if (st.resolveActivity(pm) != null) {
                        go = st;
                        how = "send";
                    } else {
                        go = launch;
                        how = "copy";
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "send", e);
            return "fail";
        }
        if (!copied && ("copy".equals(how) || "web".equals(how))) return "fail";
        final Intent start = go;
        act.runOnUiThread(() -> {
            try {
                act.startActivity(start);
            } catch (Exception e) {
                Log.w(TAG, "start", e);
                Toast.makeText(act, "تعذّر فتح التطبيق. الطلب منسوخ، الصقه يدوياً.", Toast.LENGTH_LONG).show();
            }
        });
        return how;
    }

    /* ---------- photos ---------- */

    File shotsDir() {
        File d = new File(act.getCacheDir(), "shots");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private File imageFile(String id) {
        if (id == null || !IMG_ID.matcher(id).matches()) return null;
        File f = new File(shotsDir(), id + ".jpg");
        return f.isFile() ? f : null;
    }

    private Uri uriFor(File f) {
        return FileProvider.getUriForFile(act, act.getPackageName() + ".files", f);
    }

    private void emitImg(String ev, String msg) {
        act.emit("img", MainActivity.obj("ev", ev, "msg", msg == null ? "" : msg));
    }

    /** UI thread. src = "camera" or "gallery". Result arrives as event img {ev:"ok",id,w,h} | {ev:"cancel"} | {ev:"error",msg}. */
    void pickImage(String src) {
        try {
            if ("gallery".equals(src)) {
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                act.startActivityForResult(Intent.createChooser(i, "اختر صورة"), REQ_PICK);
            } else {
                File cap = new File(shotsDir(), CAP_NAME);
                if (cap.exists()) cap.delete();
                Uri out = uriFor(cap);
                Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                i.putExtra(MediaStore.EXTRA_OUTPUT, out);
                i.setClipData(ClipData.newRawUri("Fasih", out));
                i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                act.startActivityForResult(i, REQ_CAM);
            }
        } catch (ActivityNotFoundException e) {
            Toast.makeText(act, "لا يوجد تطبيق كاميرا أو معرض في هذا الهاتف", Toast.LENGTH_LONG).show();
            emitImg("error", "no app");
        } catch (Exception e) {
            Log.w(TAG, "pickImage", e);
            emitImg("error", String.valueOf(e.getMessage()));
        }
    }

    /** Called from the activity. Returns true if the result belonged to a photo request. */
    boolean onResult(int req, int res, Intent data) {
        if (req != REQ_CAM && req != REQ_PICK) return false;
        if (res != Activity.RESULT_OK) {
            emitImg("cancel", null);
            return true;
        }
        final Uri src = req == REQ_PICK && data != null ? data.getData() : null;
        final File cap = req == REQ_CAM ? new File(shotsDir(), CAP_NAME) : null;
        if (src == null && (cap == null || !cap.isFile())) {
            emitImg("error", "no photo");
            return true;
        }
        new Thread(() -> processImage(src, cap), "fasih-img").start();
        return true;
    }

    private InputStream open(Uri src, File cap) throws IOException {
        InputStream in = src != null ? act.getContentResolver().openInputStream(src) : new FileInputStream(cap);
        if (in == null) throw new IOException("no stream");
        return in;
    }

    /** Scaled, upright JPEG copy in cache/shots/<id>.jpg. */
    private void processImage(Uri src, File cap) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream in = open(src, cap)) {
                BitmapFactory.decodeStream(in, null, bounds);
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("not an image");
            int longest = Math.max(bounds.outWidth, bounds.outHeight), sample = 1;
            while (longest / (sample * 2) >= MAX_SIDE) sample *= 2;
            BitmapFactory.Options opt = new BitmapFactory.Options();
            opt.inSampleSize = sample;
            Bitmap bm;
            try (InputStream in = open(src, cap)) {
                bm = BitmapFactory.decodeStream(in, null, opt);
            }
            if (bm == null) throw new IOException("decode failed");
            int rot = 0;
            try (InputStream in = open(src, cap)) {
                ExifInterface ex = new ExifInterface(in);
                int o = ex.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                if (o == ExifInterface.ORIENTATION_ROTATE_90) rot = 90;
                else if (o == ExifInterface.ORIENTATION_ROTATE_180) rot = 180;
                else if (o == ExifInterface.ORIENTATION_ROTATE_270) rot = 270;
            } catch (Exception ignored) {
            }
            float scale = Math.min(1f, (float) MAX_SIDE / Math.max(bm.getWidth(), bm.getHeight()));
            if (rot != 0 || scale < 1f) {
                Matrix m = new Matrix();
                if (scale < 1f) m.postScale(scale, scale);
                if (rot != 0) m.postRotate(rot);
                Bitmap b2 = Bitmap.createBitmap(bm, 0, 0, bm.getWidth(), bm.getHeight(), m, true);
                if (b2 != bm) bm.recycle();
                bm = b2;
            }
            String id = Long.toString(System.currentTimeMillis(), 36);
            File out = new File(shotsDir(), id + ".jpg");
            try (FileOutputStream os = new FileOutputStream(out)) {
                bm.compress(Bitmap.CompressFormat.JPEG, 85, os);
            }
            int w = bm.getWidth(), h = bm.getHeight();
            bm.recycle();
            if (cap != null) cap.delete();
            act.emit("img", MainActivity.obj("ev", "ok", "id", id, "w", w, "h", h));
        } catch (Throwable e) {
            Log.w(TAG, "processImage", e);
            emitImg("error", String.valueOf(e.getMessage()));
        }
    }

    /* ---------- API keys (never returned to the web page) ---------- */

    private SharedPreferences prefs() {
        return act.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey secret() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        Key k = ks.getKey(KS_ALIAS, null);
        if (k instanceof SecretKey) return (SecretKey) k;
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KS_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }

    private boolean saveKey(String provider, String key) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, secret());
            byte[] iv = c.getIV();
            byte[] ct = c.doFinal(key.getBytes(StandardCharsets.UTF_8));
            byte[] all = new byte[1 + iv.length + ct.length];
            all[0] = (byte) iv.length;
            System.arraycopy(iv, 0, all, 1, iv.length);
            System.arraycopy(ct, 0, all, 1 + iv.length, ct.length);
            prefs().edit().putString(provider, Base64.encodeToString(all, Base64.NO_WRAP)).apply();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "saveKey", e);
            return false;
        }
    }

    private String loadKey(String provider) {
        try {
            String s = prefs().getString(provider, null);
            if (s == null) return null;
            byte[] all = Base64.decode(s, Base64.NO_WRAP);
            int n = all[0];
            if (n <= 0 || all.length < 1 + n + 16) return null;
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, secret(), new GCMParameterSpec(128, all, 1, n));
            return new String(c.doFinal(all, 1 + n, all.length - 1 - n), StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.w(TAG, "loadKey", e);
            return null;
        }
    }

    /** {"claude":true,"chatgpt":false,...} */
    String keys() {
        JSONObject o = new JSONObject();
        SharedPreferences p = prefs();
        for (String[] a : APPS) {
            try {
                o.put(a[0], p.contains(a[0]));
            } catch (JSONException ignored) {
            }
        }
        return o.toString();
    }

    private void emitKey(String provider) {
        act.emit("aikey", MainActivity.obj("p", provider, "has", prefs().contains(provider)));
    }

    /** UI thread. Native dialog so the key never passes through the web page. */
    void askKey(final String provider) {
        final String[] app = find(provider);
        if (app == null) return;
        final EditText in = new EditText(act);
        in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        in.setHint("API key");
        in.setSingleLine(true);
        in.setImeOptions(EditorInfo.IME_ACTION_DONE);
        in.setTextDirection(View.TEXT_DIRECTION_LTR);
        FrameLayout box = new FrameLayout(act);
        int pad = (int) (20 * act.getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad / 2, pad, 0);
        box.addView(in);
        AlertDialog.Builder b = new AlertDialog.Builder(act)
                .setTitle("مفتاح " + app[3])
                .setMessage("الصق مفتاح API الخاص بك. يُحفظ مشفّراً في هذا الهاتف، ولا يُرسل إلا إلى " + app[4] + ".")
                .setView(box)
                .setPositiveButton("حفظ", (d, w) -> {
                    String k = in.getText().toString().trim();
                    if (k.length() < 8 || k.length() > 400 || !k.matches("[\\x21-\\x7E]+")) {
                        Toast.makeText(act, "هذا لا يبدو مفتاحاً صالحاً", Toast.LENGTH_LONG).show();
                        return;
                    }
                    boolean ok = saveKey(provider, k);
                    Toast.makeText(act, ok ? "حُفظ المفتاح ✓" : "تعذّر حفظ المفتاح", Toast.LENGTH_SHORT).show();
                    emitKey(provider);
                })
                .setNegativeButton("إلغاء", null);
        if (prefs().contains(provider)) {
            b.setNeutralButton("حذف المفتاح", (d, w) -> {
                prefs().edit().remove(provider).apply();
                Toast.makeText(act, "حُذف المفتاح", Toast.LENGTH_SHORT).show();
                emitKey(provider);
            });
        }
        final AlertDialog dlg = b.create();
        // "Done" on the keyboard saves, like the button
        in.setOnEditorActionListener((v, actionId, ev) -> {
            boolean enter = ev != null && ev.getKeyCode() == KeyEvent.KEYCODE_ENTER && ev.getAction() == KeyEvent.ACTION_DOWN;
            if (actionId != EditorInfo.IME_ACTION_DONE && !enter) return false;
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
            return true;
        });
        Window win = dlg.getWindow();
        if (win != null) {
            win.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            win.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE);
        }
        dlg.show();
        in.requestFocus();
    }

    /* ---------- HTTPS transport for API mode ---------- */

    private void emitHttp(String id, String ev, String field, Object value) {
        act.emit("http", field == null ? MainActivity.obj("id", id, "ev", ev) : MainActivity.obj("id", id, "ev", ev, field, value));
    }

    private void emitHttpError(String id, int status, String body) {
        act.emit("http", MainActivity.obj("id", id, "ev", "error", "status", status, "body", body == null ? "" : body));
    }

    /** json = {id, p, method, path, body, stream}. Host and authentication depend only on p. */
    void http(String json) {
        final String id, provider, method, path, body;
        final boolean stream;
        try {
            JSONObject o = new JSONObject(json);
            id = o.optString("id");
            provider = o.optString("p");
            method = o.optString("method", "POST").toUpperCase(Locale.ROOT);
            path = o.optString("path");
            body = o.optString("body", "");
            stream = o.optBoolean("stream", false);
        } catch (JSONException e) {
            Log.w(TAG, "http json", e);
            return;
        }
        if (id.isEmpty()) return;
        final String[] app = find(provider);
        boolean okMethod = "GET".equals(method) || "POST".equals(method);
        if (app == null || !okMethod || path.contains("..") || path.contains("//") || !PATH.matcher(path).matches()) {
            emitHttpError(id, 0, "bad request");
            return;
        }
        try {
            pool.execute(() -> run(id, app, method, path, body, stream));
        } catch (Exception e) {
            emitHttpError(id, 0, "busy");
        }
    }

    void cancel(String id) {
        HttpURLConnection c = id == null ? null : live.get(id);
        if (c == null) return;
        cancelled.add(id);
        try {
            c.disconnect();
        } catch (Exception ignored) {
        }
    }

    private static byte[] readAll(File f) throws IOException {
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream((int) Math.max(1024, f.length()));
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) != -1) bo.write(buf, 0, n);
            return bo.toByteArray();
        }
    }

    private String inlineImages(String body) throws IOException {
        Matcher m = IMG.matcher(body);
        if (!m.find()) return body;
        m.reset();
        StringBuffer sb = new StringBuffer(body.length() + 700_000);
        while (m.find()) {
            File f = imageFile(m.group(1));
            if (f == null) throw new IOException("photo no longer available");
            m.appendReplacement(sb, Base64.encodeToString(readAll(f), Base64.NO_WRAP));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String readSome(InputStream in, int max) {
        if (in == null) return "";
        try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[2048];
            int n;
            while (sb.length() < max && (n = r.read(buf)) != -1) sb.append(buf, 0, n);
            return sb.length() > max ? sb.substring(0, max) : sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void run(String id, String[] app, String method, String path, String body, boolean stream) {
        HttpURLConnection c = null;
        try {
            String key = loadKey(app[0]);
            if (key == null) {
                emitHttpError(id, 401, "no usable key saved for " + app[3]);
                return;
            }
            URL url = new URL("https://" + app[4] + path);
            c = (HttpURLConnection) url.openConnection();
            live.put(id, c);
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000);
            c.setReadTimeout(stream ? 120000 : 45000);
            c.setRequestMethod(method);
            c.setRequestProperty("Accept", stream ? "text/event-stream" : "application/json");
            c.setRequestProperty("User-Agent", "Fasih/" + BuildConfig.VERSION_NAME + " (Android)");
            if ("bearer".equals(app[5])) c.setRequestProperty("Authorization", "Bearer " + key);
            else c.setRequestProperty(app[5], key);
            if ("claude".equals(app[0])) c.setRequestProperty("anthropic-version", "2023-06-01");
            if ("POST".equals(method)) {
                byte[] data = inlineImages(body).getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setFixedLengthStreamingMode(data.length);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(data);
                }
            }
            int status = c.getResponseCode();
            if (status < 200 || status >= 300) {
                String err = readSome(c.getErrorStream(), 4096);
                if (!cancelled.contains(id)) emitHttpError(id, status, err);
                return;
            }
            emitHttp(id, "open", "status", status);
            try (Reader r = new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8)) {
                char[] buf = new char[8192];
                StringBuilder sb = new StringBuilder();
                int n;
                while ((n = r.read(buf)) != -1) {
                    if (cancelled.contains(id)) break;
                    sb.append(buf, 0, n);
                    if (sb.length() >= 16384 || !r.ready()) {
                        emitHttp(id, "data", "text", sb.toString());
                        sb.setLength(0);
                    }
                }
                if (sb.length() > 0 && !cancelled.contains(id)) emitHttp(id, "data", "text", sb.toString());
            }
            if (!cancelled.contains(id)) emitHttp(id, "done", null, null);
        } catch (Exception e) {
            if (!cancelled.contains(id)) {
                emitHttpError(id, 0, e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage()));
            }
        } finally {
            live.remove(id);
            cancelled.remove(id);
            if (c != null) {
                try {
                    c.disconnect();
                } catch (Exception ignored) {
                }
            }
        }
    }
}
