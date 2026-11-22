package io.github.krt123456.fasih;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
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

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Fasih: English-learning app that works offline. The web app is embedded and served from assets by
 * WebViewAssetLoader on a stable https address (so localStorage persists). Progress is also copied
 * to an internal file (bridge FasihNative) and read back when web storage is empty.
 */
public class MainActivity extends Activity {
    private static final String TAG = "Fasih";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final String STATE = "fasih-state.json";
    private static final int REQ_OPEN = 41;
    private static final int REQ_SAVE = 42;
    private static final int REQ_NOTIF = 51;
    private static final int REQ_MIC = 52;

    private WebView web;
    private WebViewAssetLoader loader;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSave;
    private final Object lock = new Object();

    // text to speech
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    private boolean ttsFailed;
    private String pendingSpeak;
    private volatile String curId = "";
    private volatile String lastUtt = "";

    // speech recognition / recording
    private SpeechRecognizer recognizer;
    private MediaRecorder recorder;
    private long recStartedAt;
    private MediaPlayer player;
    private String pendingMic = "";
    private String pendingSttLang = "en-US";

    private String launchFrom = "";
    AiBridge ai;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        Intent it = getIntent();
        if (debuggable || (it != null && it.getBooleanExtra("devtools", false))) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        readLaunch(it);
        ai = new AiBridge(this);
        ai.readIntent(it, saved == null);
        loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/shots/", new WebViewAssetLoader.InternalStoragePathHandler(this, ai.shotsDir()))
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
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " FasihApp/" + BuildConfig.VERSION_NAME);

        web.addJavascriptInterface(new Bridge(), "FasihNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                toast("استخدم زر التصدير في الإعدادات");
                return;
            }
            openExternal(url);
        });

        initTts();

        if (saved == null || web.restoreState(saved) == null) {
            web.loadUrl(START);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readLaunch(intent);
        if ("notif".equals(launchFrom)) emit("launch", obj("from", "notif"));
        if (ai != null && ai.readIntent(intent, true)) emit("shared", obj("n", 1));
    }

    private void readLaunch(Intent it) {
        String f = it == null ? null : it.getStringExtra("from");
        if (f != null && !f.isEmpty()) launchFrom = f;
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            toast("تعذّر فتح هذا الرابط");
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    private void toastLong(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    /* ---------- events to JavaScript ---------- */
    static JSONObject obj(Object... kv) {
        JSONObject o = new JSONObject();
        try {
            for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]);
        } catch (JSONException e) {
            Log.w(TAG, "json", e);
        }
        return o;
    }

    void emit(String type, JSONObject data) {
        // U+2028 / U+2029 are legal in JSON but break JavaScript source on old WebViews
        final String json = data.toString().replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
        final String js = "window.Fasih&&Fasih.onNative&&Fasih.onNative(" + JSONObject.quote(type) + "," + json + ")";
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    /* ---------- internal copy of the state (atomic write) ---------- */
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
                Log.e(TAG, "write failed", e);
                return false;
            }
            if (!tmp.renameTo(dst)) {
                Log.e(TAG, "rename failed");
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
                Log.e(TAG, "read failed", e);
                return "";
            }
        }
    }

    /* ---------- text to speech ---------- */
    private void initTts() {
        tts = new TextToSpeech(this, status -> runOnUiThread(() -> {
            if (tts == null) return;
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        String id = ownId(utteranceId);
                        if (id == null) return;
                        String tag = utteranceId.substring(utteranceId.lastIndexOf('#') + 1);
                        if (tag.matches("\\d+")) {
                            emit("tts", obj("id", id, "ev", "start", "i", Integer.parseInt(tag)));
                        }
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        String id = ownId(utteranceId);
                        if (id != null && utteranceId.equals(lastUtt)) emit("tts", obj("id", id, "ev", "done"));
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public void onError(String utteranceId) {
                        String id = ownId(utteranceId);
                        if (id != null) {
                            lastUtt = "";
                            emit("tts", obj("id", id, "ev", "error"));
                        }
                    }

                    @Override
                    public void onError(String utteranceId, int errorCode) {
                        onError(utteranceId);
                    }
                });
                String p = pendingSpeak;
                pendingSpeak = null;
                if (p != null) speakNow(p);
            } else {
                ttsFailed = true;
                String p = pendingSpeak;
                pendingSpeak = null;
                if (p != null) {
                    emit("tts", obj("id", jsonId(p), "ev", "error"));
                }
            }
        }));
    }

    /** The JS id of an utterance that belongs to the current request, else null. */
    private String ownId(String utteranceId) {
        if (utteranceId == null) return null;
        int k = utteranceId.lastIndexOf('#');
        if (k < 0) return null;
        String id = utteranceId.substring(0, k);
        return id.equals(curId) ? id : null;
    }

    private static String jsonId(String json) {
        try {
            return new JSONObject(json).optString("id", "");
        } catch (JSONException e) {
            return "";
        }
    }

    private static Locale toLocale(String tag) {
        if ("en-GB".equals(tag)) return Locale.UK;
        if ("en-AU".equals(tag)) return Locale.forLanguageTag("en-AU");
        return Locale.US;
    }

    private boolean avail(Locale l, int min) {
        try {
            return tts != null && tts.isLanguageAvailable(l) >= min;
        } catch (Exception e) {
            return false;
        }
    }

    /** Requested accent, else en-US, en-GB, then plain English; null when no English voice exists. */
    private Locale resolveLocale(String lang) {
        Locale[] order = {toLocale(lang), Locale.US, Locale.UK, Locale.ENGLISH};
        for (Locale l : order) {
            if (avail(l, TextToSpeech.LANG_COUNTRY_AVAILABLE)) return l;
        }
        if (avail(Locale.ENGLISH, TextToSpeech.LANG_AVAILABLE)) return Locale.ENGLISH;
        return null;
    }

    private static List<String> splitText(String text, int max) {
        List<String> parts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String sentence : text.split("(?<=[.!?;:])\\s+")) {
            if (cur.length() + sentence.length() + 1 > max && cur.length() > 0) {
                parts.add(cur.toString());
                cur.setLength(0);
            }
            if (sentence.length() > max) {
                for (int i = 0; i < sentence.length(); i += max) {
                    parts.add(sentence.substring(i, Math.min(sentence.length(), i + max)));
                }
            } else {
                cur.append(sentence).append(' ');
            }
        }
        if (cur.length() > 0) parts.add(cur.toString());
        return parts;
    }

    private void speakNow(String json) {
        JSONObject req;
        try {
            req = new JSONObject(json);
        } catch (JSONException e) {
            Log.w(TAG, "speak: bad json", e);
            return;
        }
        String id = req.optString("id", "");
        if (tts == null || ttsFailed) {
            emit("tts", obj("id", id, "ev", "error"));
            return;
        }
        if (!ttsReady) {
            pendingSpeak = json;
            return;
        }
        JSONArray items = req.optJSONArray("items");
        tts.stop();
        curId = id;
        lastUtt = "";
        if (items == null || items.length() == 0) {
            emit("tts", obj("id", id, "ev", "done"));
            return;
        }
        int max = Math.max(200, TextToSpeech.getMaxSpeechInputLength() - 50);
        // first pass: validate and build the queue
        List<Object[]> queue = new ArrayList<>(); // {utterance id, text, locale, rate, pitch, silentMs}
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String text = item.optString("t", "");
            Locale loc = resolveLocale(item.optString("lang", "en-US"));
            if (loc == null) {
                emit("tts", obj("id", id, "ev", "nolang"));
                toastLong("لا يوجد صوت إنجليزي. ثبّت صوتًا إنجليزيًا من إعدادات تحويل النص إلى كلام في الهاتف.");
                return;
            }
            float rate = (float) Math.max(0.3, Math.min(3.0, item.optDouble("rate", 1.0)));
            float pitch = (float) Math.max(0.5, Math.min(2.0, item.optDouble("pitch", 1.0)));
            int pause = item.optInt("pause", 0);
            if (!text.trim().isEmpty()) {
                List<String> parts = splitText(text, max);
                for (int k = 0; k < parts.size(); k++) {
                    String part = parts.get(k).trim();
                    if (part.isEmpty()) continue;
                    String uid = id + "#" + i + (k == 0 ? "" : "." + k);
                    queue.add(new Object[]{uid, part, loc, rate, pitch, 0});
                }
            }
            if (pause > 0) {
                queue.add(new Object[]{id + "#" + i + ".p", null, loc, rate, pitch, pause});
            }
        }
        if (queue.isEmpty()) {
            emit("tts", obj("id", id, "ev", "done"));
            return;
        }
        lastUtt = (String) queue.get(queue.size() - 1)[0];
        for (Object[] q : queue) {
            String uid = (String) q[0];
            String part = (String) q[1];
            if (part == null) {
                tts.playSilentUtterance(((Integer) q[5]).longValue(), TextToSpeech.QUEUE_ADD, uid);
            } else {
                tts.setLanguage((Locale) q[2]);
                tts.setSpeechRate((Float) q[3]);
                tts.setPitch((Float) q[4]);
                tts.speak(part, TextToSpeech.QUEUE_ADD, null, uid);
            }
        }
    }

    private String ttsInfoJson() {
        JSONArray langs = new JSONArray();
        if (ttsReady && tts != null) {
            String[] tags = {"en-GB", "en-US", "en-AU"};
            for (String t : tags) {
                if (avail(toLocale(t), TextToSpeech.LANG_COUNTRY_AVAILABLE)) langs.put(t);
            }
        }
        return obj("ready", ttsReady, "langs", langs).toString();
    }

    /* ---------- permissions ---------- */
    private boolean hasMic() {
        return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        return nm == null || nm.areNotificationsEnabled();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQ_NOTIF) {
            emit("perm", obj("name", "notif", "granted", granted));
        } else if (requestCode == REQ_MIC) {
            String what = pendingMic;
            pendingMic = "";
            emit("perm", obj("name", "mic", "granted", granted));
            if (granted) {
                if ("stt".equals(what)) doSttStart(pendingSttLang);
                else if ("rec".equals(what)) doRecStart();
            } else if ("stt".equals(what)) {
                emit("stt", obj("ev", "denied"));
            } else if ("rec".equals(what)) {
                emit("rec", obj("ev", "denied"));
            }
        }
    }

    /* ---------- speech recognition ---------- */
    private void doSttStart(String lang) {
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                emit("stt", obj("ev", "error", "code", -1));
                return;
            }
            if (recognizer == null) {
                recognizer = SpeechRecognizer.createSpeechRecognizer(this);
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) { emit("stt", obj("ev", "ready")); }
                    @Override public void onBeginningOfSpeech() { }
                    @Override public void onRmsChanged(float rmsdB) { }
                    @Override public void onBufferReceived(byte[] buffer) { }
                    @Override public void onEndOfSpeech() { emit("stt", obj("ev", "end")); }
                    @Override public void onError(int error) { emit("stt", obj("ev", "error", "code", error)); }
                    @Override public void onEvent(int eventType, Bundle params) { }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> r = partialResults == null ? null : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (r != null && !r.isEmpty()) emit("stt", obj("ev", "partial", "text", r.get(0)));
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> r = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        JSONArray alts = new JSONArray();
                        String text = "";
                        if (r != null) {
                            for (int i = 0; i < r.size(); i++) alts.put(r.get(i));
                            if (!r.isEmpty()) text = r.get(0);
                        }
                        emit("stt", obj("ev", "result", "text", text, "alts", alts));
                    }
                });
            }
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang == null || lang.isEmpty() ? "en-US" : lang);
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
            recognizer.cancel();
            recognizer.startListening(i);
        } catch (Exception e) {
            Log.e(TAG, "stt", e);
            emit("stt", obj("ev", "error", "code", -1));
        }
    }

    /* ---------- recording and playback ---------- */
    private File recFile() {
        return new File(getCacheDir(), "rec.m4a");
    }

    private void releasePlayer() {
        MediaPlayer p = player;
        player = null;
        if (p != null) {
            try { p.stop(); } catch (Exception ignored) { }
            try { p.release(); } catch (Exception ignored) { }
        }
    }

    private void releaseRecorder() {
        MediaRecorder r = recorder;
        recorder = null;
        if (r != null) {
            try { r.reset(); } catch (Exception ignored) { }
            try { r.release(); } catch (Exception ignored) { }
        }
    }

    @SuppressWarnings("deprecation")
    private void doRecStart() {
        releasePlayer();
        releaseRecorder();
        try {
            MediaRecorder r = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(this) : new MediaRecorder();
            recorder = r;
            r.setAudioSource(MediaRecorder.AudioSource.MIC);
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            r.setAudioSamplingRate(44100);
            r.setAudioEncodingBitRate(64000);
            r.setOutputFile(recFile().getAbsolutePath());
            r.prepare();
            r.start();
            recStartedAt = SystemClock.elapsedRealtime();
            emit("rec", obj("ev", "started"));
        } catch (Exception e) {
            Log.e(TAG, "rec start", e);
            releaseRecorder();
            emit("rec", obj("ev", "error", "msg", String.valueOf(e.getMessage())));
        }
    }

    private void doRecStop() {
        MediaRecorder r = recorder;
        if (r == null) return;
        recorder = null;
        long ms = SystemClock.elapsedRealtime() - recStartedAt;
        boolean ok = true;
        String err = "";
        try {
            r.stop();
        } catch (RuntimeException e) {
            ok = false;
            err = "recording too short";
        }
        try { r.release(); } catch (Exception ignored) { }
        if (ok) emit("rec", obj("ev", "stopped", "ms", ms));
        else emit("rec", obj("ev", "error", "msg", err));
    }

    private void doRecPlay() {
        if (recorder != null) doRecStop();
        releasePlayer();
        File f = recFile();
        if (!f.exists() || f.length() == 0) {
            emit("rec", obj("ev", "error", "msg", "no recording"));
            return;
        }
        try {
            MediaPlayer p = new MediaPlayer();
            player = p;
            p.setDataSource(f.getAbsolutePath());
            p.setOnCompletionListener(mp -> {
                if (player == mp) releasePlayer();
                emit("rec", obj("ev", "played"));
            });
            p.setOnErrorListener((mp, what, extra) -> {
                if (player == mp) releasePlayer();
                emit("rec", obj("ev", "error", "msg", "playback " + what));
                return true;
            });
            p.prepare();
            p.start();
        } catch (Exception e) {
            Log.e(TAG, "rec play", e);
            releasePlayer();
            emit("rec", obj("ev", "error", "msg", String.valueOf(e.getMessage())));
        }
    }

    /* ---------- system bars ---------- */
    private void applyBars(String status, String nav, boolean lightStatus, boolean lightNav) {
        try {
            Window w = getWindow();
            w.setStatusBarColor(Color.parseColor(status));
            w.setNavigationBarColor(Color.parseColor(nav));
            if (Build.VERSION.SDK_INT >= 30) {
                WindowInsetsController c = w.getInsetsController();
                if (c != null) {
                    c.setSystemBarsAppearance(lightStatus ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0,
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                    c.setSystemBarsAppearance(lightNav ? WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0,
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                }
            } else {
                View d = w.getDecorView();
                int f = d.getSystemUiVisibility();
                f = lightStatus ? (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                if (Build.VERSION.SDK_INT >= 26) {
                    f = lightNav ? (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                }
                d.setSystemUiVisibility(f);
            }
        } catch (Exception e) {
            Log.w(TAG, "bar colours", e);
        }
    }

    /* ---------- JavaScript bridge: window.FasihNative ---------- */
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

        /* --- speech output --- */
        @JavascriptInterface
        public void speak(String json) {
            runOnUiThread(() -> speakNow(json));
        }

        @JavascriptInterface
        public void stopSpeak() {
            runOnUiThread(() -> {
                pendingSpeak = null;
                lastUtt = "";
                if (tts != null) tts.stop();
            });
        }

        @JavascriptInterface
        public String ttsInfo() {
            return ttsInfoJson();
        }

        /* --- speech input --- */
        @JavascriptInterface
        public boolean sttAvailable() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }

        @JavascriptInterface
        public void sttStart(String lang) {
            runOnUiThread(() -> {
                if (!hasMic()) {
                    pendingMic = "stt";
                    pendingSttLang = lang == null || lang.isEmpty() ? "en-US" : lang;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                    return;
                }
                doSttStart(lang);
            });
        }

        @JavascriptInterface
        public void sttStop() {
            runOnUiThread(() -> {
                try {
                    if (recognizer != null) recognizer.stopListening();
                } catch (Exception e) {
                    Log.w(TAG, "stt stop", e);
                }
            });
        }

        @JavascriptInterface
        public void sttCancel() {
            runOnUiThread(() -> {
                try {
                    if (recognizer != null) recognizer.cancel();
                } catch (Exception e) {
                    Log.w(TAG, "stt cancel", e);
                }
            });
        }

        /* --- recording --- */
        @JavascriptInterface
        public void recStart() {
            runOnUiThread(() -> {
                if (!hasMic()) {
                    pendingMic = "rec";
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                    return;
                }
                doRecStart();
            });
        }

        @JavascriptInterface
        public void recStop() {
            runOnUiThread(() -> doRecStop());
        }

        @JavascriptInterface
        public void recPlay() {
            runOnUiThread(() -> doRecPlay());
        }

        @JavascriptInterface
        public void recStopPlay() {
            runOnUiThread(() -> releasePlayer());
        }

        /* --- reminders --- */
        @JavascriptInterface
        public void setReminders(String json) {
            ReminderReceiver.saveConfig(MainActivity.this, json);
        }

        @JavascriptInterface
        public void setDayStatus(String date, boolean done, int leftMin, int streak) {
            ReminderReceiver.setDayStatus(MainActivity.this, date, done, leftMin, streak);
        }

        @JavascriptInterface
        public String reminderState() {
            Context c = MainActivity.this;
            boolean on = false;
            try {
                String cfg = ReminderReceiver.prefs(c).getString("cfg", "");
                on = cfg != null && !cfg.isEmpty() && new JSONObject(cfg).optBoolean("on", false);
            } catch (JSONException ignored) {
            }
            boolean exact = true;
            if (Build.VERSION.SDK_INT >= 31) {
                AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
                exact = am != null && am.canScheduleExactAlarms();
            }
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            boolean battery = pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
            long next = ReminderReceiver.nextTrigger(c, System.currentTimeMillis());
            return obj("on", on, "notifAllowed", notificationsAllowed(), "exactAllowed", exact,
                    "batteryIgnored", battery, "next", next).toString();
        }

        @JavascriptInterface
        public void askNotifPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
                } else {
                    emit("perm", obj("name", "notif", "granted", notificationsAllowed()));
                }
            });
        }

        @JavascriptInterface
        public void openNotifSettings() {
            runOnUiThread(() -> {
                try {
                    Intent i;
                    if (Build.VERSION.SDK_INT >= 26) {
                        i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    } else {
                        i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                    }
                    startActivity(i);
                } catch (Exception e) {
                    toast("تعذّر فتح الإعدادات");
                }
            });
        }

        @JavascriptInterface
        public void askBatteryExemption() {
            runOnUiThread(() -> {
                try {
                    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                    if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) return;
                    startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                    } catch (Exception e2) {
                        toast("تعذّر فتح الإعدادات");
                    }
                }
            });
        }

        @JavascriptInterface
        public void testReminder() {
            ReminderReceiver.notifyNow(MainActivity.this, true);
        }

        /* --- misc --- */
        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title);
                i.putExtra(Intent.EXTRA_TEXT, text);
                try {
                    Intent ch = Intent.createChooser(i, title);
                    ch.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new android.content.ComponentName[]{getComponentName()});
                    startActivity(ch);
                } catch (Exception e) {
                    MainActivity.this.toast("تعذّرت المشاركة");
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
        public void openExternal(String url) {
            runOnUiThread(() -> MainActivity.this.openExternal(url));
        }

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() -> MainActivity.this.toast(msg));
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                long d = Math.max(1, Math.min(2000, ms));
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(d);
                }
            } catch (Exception e) {
                Log.w(TAG, "vibrate", e);
            }
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        /** Phone's dark theme (for the web app's "Automatic" theme). */
        @JavascriptInterface
        public boolean isNight() {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        }

        @JavascriptInterface
        public void setBars(String statusColor, String navColor, boolean lightStatus, boolean lightNav) {
            runOnUiThread(() -> applyBars(statusColor, navColor, lightStatus, lightNav));
        }

        /* --- AI tutor: hand-off to the learner's AI app, photos, optional API mode (see AiBridge) --- */
        @JavascriptInterface
        public String aiApps() {
            return ai.apps();
        }

        @JavascriptInterface
        public String aiSend(String key, String text, String img) {
            return ai.send(key, text, img);
        }

        @JavascriptInterface
        public boolean copyText(String text) {
            return ai.copy(text);
        }

        @JavascriptInterface
        public String pasteText() {
            return ai.paste();
        }

        @JavascriptInterface
        public String takeShared() {
            return ai.takeShared();
        }

        @JavascriptInterface
        public String takeSharedImage() {
            return ai.takeSharedImage();
        }

        @JavascriptInterface
        public void pickImage(String src) {
            runOnUiThread(() -> ai.pickImage(src));
        }

        @JavascriptInterface
        public String aiKeys() {
            return ai.keys();
        }

        @JavascriptInterface
        public void askAiKey(String provider) {
            runOnUiThread(() -> ai.askKey(provider));
        }

        @JavascriptInterface
        public void aiHttp(String json) {
            ai.http(json);
        }

        @JavascriptInterface
        public void aiHttpCancel(String id) {
            ai.cancel(id);
        }

        /** {"from":"notif"} if the activity was opened from a notification (consumed once). */
        @JavascriptInterface
        public String launchInfo() {
            String f = launchFrom;
            launchFrom = "";
            return obj("from", f == null ? "" : f).toString();
        }
    }

    /* ---------- navigation ---------- */
    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            // The page is served from the app itself and may never reach the network:
            // only the native AI transport (AiBridge) talks to the internet.
            Uri u = request.getUrl();
            WebResourceResponse r = HOST.equals(u.getHost()) ? loader.shouldInterceptRequest(u) : null;
            if (r != null) return r;
            return new WebResourceResponse("text/plain", "utf-8", 403, "Blocked",
                    new java.util.HashMap<String, String>(), new java.io.ByteArrayInputStream(new byte[0]));
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            openExternal(u.toString());
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            Log.w(TAG, "web renderer gone, restarting");
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
                    startActivityForResult(Intent.createChooser(g, "اختر الملف"), REQ_OPEN);
                } catch (Exception e2) {
                    fileCallback = null;
                    toast("لا يوجد تطبيق لاختيار الملفات");
                    return false;
                }
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }

        @Override
        public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("حسنًا", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("حسنًا", (d, w) -> result.confirm())
                    .setNegativeButton("إلغاء", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            int level = m.messageLevel() == ConsoleMessage.MessageLevel.ERROR ? Log.ERROR : Log.INFO;
            Log.println(level, "FasihJS", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }
    }

    /* ---------- lifecycle ---------- */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (ai != null && ai.onResult(requestCode, resultCode, data)) return;
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
                    if (os == null) throw new IllegalStateException("stream unavailable");
                    os.write(content.getBytes(StandardCharsets.UTF_8));
                    toast("تم حفظ الملف ✓");
                } catch (Exception e) {
                    Log.e(TAG, "export", e);
                    toast("فشل حفظ الملف");
                }
            }
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            moveTaskToBack(true);
            return;
        }
        web.evaluateJavascript("(window.Fasih&&Fasih.onBack)?Fasih.onBack():false", value -> {
            if (!"true".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.Fasih&&Fasih.flush&&Fasih.flush()", null);
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
        if (ai != null) ai.shutdown();
        releasePlayer();
        releaseRecorder();
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception ignored) {
            }
            recognizer = null;
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
