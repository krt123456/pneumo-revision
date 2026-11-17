package io.github.krt123456.pneumo;

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

import java.util.Calendar;

/** Rappel quotidien de révision : programmé par l'application, reprogrammé après un redémarrage du téléphone. */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION = "io.github.krt123456.pneumo.RAPPEL";
    static final String CHANNEL = "rappel";
    static final String PREFS = "rappel";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (ACTION.equals(a)) {
            notifyNow(ctx);
        } else {
            schedule(ctx); // démarrage du téléphone ou mise à jour de l'application
        }
    }

    static void save(Context ctx, boolean on, int h, int m) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("on", on).putInt("h", h).putInt("m", m).apply();
        schedule(ctx);
    }

    static String state(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return p.getBoolean("on", false) + "|" + p.getInt("h", 20) + "|" + p.getInt("m", 0);
    }

    private static PendingIntent alarmIntent(Context ctx) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION);
        return PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(ctx);
        am.cancel(pi);
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("on", false) || daysToExam() < -1) return;
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, p.getInt("h", 20));
        c.set(Calendar.MINUTE, p.getInt("m", 0));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis() + 1000) c.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
    }

    /** Jours avant l'examen (17/12/2026), arrondis au jour supérieur ; 0 le jour même, négatif après. */
    static long daysToExam() {
        Calendar exam = Calendar.getInstance();
        exam.set(2026, Calendar.DECEMBER, 17, 0, 0, 0);
        exam.set(Calendar.MILLISECOND, 0);
        long diff = exam.getTimeInMillis() - System.currentTimeMillis();
        return diff >= 0 ? (diff + 86399999L) / 86400000L : -((-diff) / 86400000L) - 1;
    }

    static void notifyNow(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Rappel de révision", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Un rappel par jour pour réviser jusqu'à l'examen");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 8, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long d = daysToExam();
        String title = d > 1 ? "J-" + d + " avant l'examen de pneumologie" : d == 1 ? "Demain : examen de pneumologie 💪" : "Pneumo Révision";
        String[] msgs = {
                "Tes révisions du jour t'attendent : 20 minutes suffisent pour garder ta série 🔥",
                "Un quiz rapide et quelques cartes ? On retient mieux en se testant chaque jour 🧠",
                "Ce que tu revois aujourd'hui, tu le retrouveras le jour J 🎯",
        };
        String text = msgs[(int) ((System.currentTimeMillis() / 86400000L) % msgs.length)];
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true);
        try {
            nm.notify(1, b.build());
        } catch (SecurityException e) {
            // notifications refusées par l'utilisateur
        }
    }
}
