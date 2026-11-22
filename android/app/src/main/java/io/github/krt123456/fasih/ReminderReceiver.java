package io.github.krt123456.fasih;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Study reminders for Fasih. The configuration JSON sent by the web app is stored as a string;
 * alarms are computed from it and from the day status (done / streak / minutes left).
 * "Study date" = local date of (now - 3 hours), so a session after midnight counts for the previous day.
 */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION_REMIND = "io.github.krt123456.fasih.REMIND";
    static final String ACTION_SNOOZE = "io.github.krt123456.fasih.SNOOZE";
    static final String CHANNEL = "study";
    static final String PREFS = "fasih";
    static final int NOTIF_ID = 1;
    private static final long SHIFT_MS = 3L * 3600_000L;
    private static final long SNOOZE_MS = 15L * 60_000L;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (a == null) return;
        switch (a) {
            case ACTION_REMIND:
                if (isOn(ctx) && !isDone(ctx, System.currentTimeMillis())) notifyNow(ctx, false);
                schedule(ctx);
                break;
            case ACTION_SNOOZE: {
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel(NOTIF_ID);
                prefs(ctx).edit().putLong("snooze", System.currentTimeMillis() + SNOOZE_MS).apply();
                schedule(ctx);
                break;
            }
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
            case Intent.ACTION_TIME_CHANGED:
            case Intent.ACTION_TIMEZONE_CHANGED:
                schedule(ctx);
                break;
            default:
                break;
        }
    }

    /* ---------- storage ---------- */
    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveConfig(Context ctx, String json) {
        prefs(ctx).edit().putString("cfg", json == null ? "" : json).apply();
        schedule(ctx);
    }

    static void setDayStatus(Context ctx, String date, boolean done, int leftMin, int streak) {
        SharedPreferences.Editor e = prefs(ctx).edit()
                .putString("date", date == null ? "" : date)
                .putBoolean("done", done)
                .putInt("left", leftMin)
                .putInt("streak", streak);
        long now = System.currentTimeMillis();
        boolean doneToday = done && studyDate(now).equals(date);
        if (doneToday) e.remove("snooze");
        e.apply();
        if (doneToday) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIF_ID);
        }
        schedule(ctx);
    }

    private static JSONObject cfg(Context ctx) {
        String s = prefs(ctx).getString("cfg", "");
        if (s == null || s.isEmpty()) return new JSONObject();
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static boolean isOn(Context ctx) {
        return cfg(ctx).optBoolean("on", false);
    }

    static String studyDate(long now) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now - SHIFT_MS));
    }

    private static boolean isDone(Context ctx, long now) {
        SharedPreferences p = prefs(ctx);
        return p.getBoolean("done", false) && studyDate(now).equals(p.getString("date", ""));
    }

    /** "HH:mm" to minutes since midnight, or -1 if invalid. */
    private static int parseHM(String s) {
        if (s == null) return -1;
        String[] p = s.trim().split(":");
        if (p.length != 2) return -1;
        try {
            int h = Integer.parseInt(p[0].trim());
            int m = Integer.parseInt(p[1].trim());
            if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
            return h * 60 + m;
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /** Epoch millis of minute-of-day {@code minute} on calendar day (studyDay + dayOffset). */
    private static long slot(Calendar studyDay, int dayOffset, int minute) {
        Calendar c = (Calendar) studyDay.clone();
        c.add(Calendar.DAY_OF_YEAR, dayOffset);
        c.set(Calendar.HOUR_OF_DAY, minute / 60);
        c.set(Calendar.MINUTE, minute % 60);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** Next moment a reminder should fire, or 0 if reminders are off or nothing is configured. */
    static long nextTrigger(Context ctx, long now) {
        JSONObject cfg = cfg(ctx);
        if (!cfg.optBoolean("on", false)) return 0;

        List<Integer> times = new ArrayList<>();
        JSONArray ta = cfg.optJSONArray("times");
        if (ta != null) {
            for (int i = 0; i < ta.length(); i++) {
                int m = parseHM(ta.optString(i, ""));
                if (m >= 0) times.add(m);
            }
        }
        int nagFrom = parseHM(cfg.optString("nagFrom", ""));
        int nagUntil = parseHM(cfg.optString("nagUntil", ""));
        int nagEvery = cfg.optInt("nagEvery", 30);
        if (nagEvery < 5) nagEvery = 5;

        // midnight of the calendar day of the current study date
        Calendar day = Calendar.getInstance();
        day.setTimeInMillis(now - SHIFT_MS);
        day.set(Calendar.HOUR_OF_DAY, 0);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);

        boolean done = isDone(ctx, now);
        long best = Long.MAX_VALUE;

        if (!done) {
            long snooze = prefs(ctx).getLong("snooze", 0L);
            if (snooze > now) return snooze; // "remind me in 15 minutes" silences earlier slots
            for (int m : times) {
                long t = slot(day, 0, m);
                if (t > now && t < best) best = t;
            }
            if (nagFrom >= 0 && nagUntil >= nagFrom) {
                for (int m = nagFrom; m <= nagUntil; m += nagEvery) {
                    long t = slot(day, 0, m);
                    if (t > now && t < best) best = t;
                }
            }
            if (best != Long.MAX_VALUE) return best;
        }

        // tomorrow's earliest time (or nagFrom when there are no fixed times)
        int first = -1;
        for (int m : times) if (first < 0 || m < first) first = m;
        if (first < 0) first = nagFrom;
        if (first < 0) return 0;
        for (int off = 1; off <= 3; off++) {
            long t = slot(day, off, first);
            if (t > now) return t;
        }
        return 0;
    }

    private static PendingIntent alarmIntent(Context ctx) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_REMIND);
        return PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(ctx);
        am.cancel(pi);
        long next = nextTrigger(ctx, System.currentTimeMillis());
        prefs(ctx).edit().putLong("next", next).apply();
        if (next <= 0) return;
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        }
    }

    /* ---------- notification ---------- */
    private static final String[] DEFAULT_MSGS = {
            "وقت فصيح! عشر دقائق من الإنجليزية اليوم تصنع الفرق.",
            "حافظ على عادتك اليومية: جلسة قصيرة الآن وتنتهي مهمتك.",
            "كلمات جديدة تنتظرك. ابدأ جلسة اليوم الآن."
    };

    private static String pickMessage(Context ctx, boolean test) {
        SharedPreferences p = prefs(ctx);
        List<String> msgs = new ArrayList<>();
        JSONArray ma = cfg(ctx).optJSONArray("msgs");
        if (ma != null) {
            for (int i = 0; i < ma.length(); i++) {
                String s = ma.optString(i, "");
                if (s != null && !s.trim().isEmpty()) msgs.add(s);
            }
        }
        if (msgs.isEmpty()) {
            for (String s : DEFAULT_MSGS) msgs.add(s);
        }
        int n = msgs.size();
        int rot = Math.max(0, p.getInt("rot", 0));
        int streak = p.getInt("streak", 0);
        int left = p.getInt("left", 0);
        for (int k = 0; k < n; k++) {
            int idx = (rot + k) % n;
            String m = msgs.get(idx);
            if (m.contains("{streak}") && streak <= 0) continue;
            if (m.contains("{left}") && left <= 0) continue;
            if (!test) p.edit().putInt("rot", (idx + 1) % n).apply();
            return m.replace("{streak}", String.valueOf(streak)).replace("{left}", String.valueOf(left));
        }
        // every message needs a value we do not have: use a built-in one
        String d = DEFAULT_MSGS[rot % DEFAULT_MSGS.length];
        if (!test) p.edit().putInt("rot", rot + 1).apply();
        return d;
    }

    @SuppressWarnings("deprecation")
    static void notifyNow(Context ctx, boolean test) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "تذكير الدراسة", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("تذكيرات يومية لمتابعة جلسة تعلّم الإنجليزية");
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        String title = cfg(ctx).optString("title", "");
        if (title == null || title.trim().isEmpty()) title = "فصيح";
        String text = pickMessage(ctx, test);

        Intent open = new Intent(ctx, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("from", "notif");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent content = PendingIntent.getActivity(ctx, 8, open, flags);
        PendingIntent start = PendingIntent.getActivity(ctx, 9, open, flags);
        Intent sn = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_SNOOZE);
        PendingIntent snooze = PendingIntent.getBroadcast(ctx, 10, sn, flags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_notif)
                .setColor(0xFF4338CA)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(content)
                .setAutoCancel(true)
                .addAction(R.drawable.ic_notif, "ابدأ الآن", start)
                .addAction(R.drawable.ic_notif, "بعد 15 دقيقة", snooze);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        try {
            nm.notify(NOTIF_ID, b.build());
        } catch (SecurityException e) {
            // notifications refused by the user
        }
    }
}
