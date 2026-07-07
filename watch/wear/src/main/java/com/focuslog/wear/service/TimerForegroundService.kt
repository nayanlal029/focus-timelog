package com.focuslog.wear.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status
import com.focuslog.wear.R
import com.focuslog.core.data.WatchSettings
import com.focuslog.core.data.local.WatchDatabase
import com.focuslog.wear.presentation.MainActivity
import com.focuslog.wear.util.fmtHMS
import com.focuslog.wear.util.vibrateCheckIn
import com.focuslog.wear.viewmodel.WatchAlert
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Keeps the active timer alive (and visible as an ongoing notification) when the app is
 * backgrounded — e.g. the user lowers their wrist or presses the home crown. The notification
 * elapsed time is recomputed from the persisted ActiveState so it stays correct across restarts.
 *
 * It also **owns the check-in reminder schedule**: because this service outlives the Activity (and
 * its ViewModel), it is the only component that can buzz + nudge the user *while they are actually
 * focusing with the app closed*. On each tick it reads the persisted timer state + check-in
 * settings (from DataStore, shared with the ViewModel) and, when a reminder is due, vibrates and
 * either emits to [ReminderBus] (app open → in-app dialog) or posts a heads-up reminder
 * notification with Snooze / Back-to-work actions (app closed).
 */
class TimerForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.Main)
    private var ticker: Job? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannels()
        startForeground(NOTIF_ID, buildNotification("Focus", 0))
        ticker = scope.launch {
            val dao = WatchDatabase.get(applicationContext).activeStateDao()
            val settings = WatchSettings(applicationContext)
            while (true) {
                val state = dao.get()
                if (state == null) { stopSelf(); break }
                val now = System.currentTimeMillis()
                val running = state.runningSince != null
                val end = state.breakStartedAt ?: now
                val focusMs = (end - state.startedAt - state.accumulatedBreakMs).coerceAtLeast(0)
                val breakMs = state.breakStartedAt?.let { (now - it).coerceAtLeast(0) } ?: 0L

                notificationManager().notify(NOTIF_ID, buildNotification(state.categoryName, focusMs))

                // When the app is in the foreground, the in-app dialog handles reminders — clear
                // any lingering heads-up so we don't show both at once.
                if (AppForeground.value) notificationManager().cancel(REMINDER_NOTIF_ID)

                if (settings.checkInEnabled.first()) {
                    val lastAt = settings.checkInLastAt.first()
                    if (lastAt == 0L) {
                        // Initialize the interval clock the first time we see an active timer.
                        settings.setCheckInLastAt(now)
                    } else {
                        val snoozedUntil = settings.checkInSnoozedUntil.first()
                        val intervalMin =
                            if (running) settings.checkInFocusMin.first() else settings.checkInBreakMin.first()
                        val intervalMs = intervalMin * 60_000L
                        if (now >= snoozedUntil && now - lastAt >= intervalMs) {
                            vibrateCheckIn(
                                applicationContext,
                                repeats = settings.checkInBuzzCount.first(),
                                intensity = settings.checkInBuzzIntensity.first(),
                            )
                            ReminderBus.alerts.tryEmit(
                                if (running) WatchAlert.FocusCheckIn else WatchAlert.BreakCheckIn
                            )
                            if (!AppForeground.value) {
                                postReminder(running, state.categoryName, focusMs, breakMs)
                            }
                            settings.setCheckInLastAt(now)
                        }
                    }
                }

                delay(1_000)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_SNOOZE) {
            val settings = WatchSettings(applicationContext)
            val now = System.currentTimeMillis()
            scope.launch {
                settings.setCheckInSnoozedUntil(now + CHECKIN_SNOOZE_MS)
                settings.setCheckInLastAt(now)
            }
            notificationManager().cancel(REMINDER_NOTIF_ID)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        ticker?.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(title: String, elapsedMs: Long): Notification {
        // Tapping the ongoing chip / notification jumps straight back into the running timer.
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_timer)
            .setContentTitle(title)
            .setContentText(fmtHMS(elapsedMs))
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pending)

        // OngoingActivity surfaces the live timer on the watch face / ongoing chip, so it stays
        // visible and one tap away even when the user leaves the app or returns to the watch home.
        OngoingActivity.Builder(applicationContext, NOTIF_ID, builder)
            .setStaticIcon(R.drawable.ic_timer)
            .setTouchIntent(pending)
            .setStatus(Status.Builder().addTemplate(title).build())
            .build()
            .apply(applicationContext)

        return builder.build()
    }

    /** Heads-up "Back to work?" reminder shown when the app is closed (with working buttons). */
    private fun postReminder(running: Boolean, category: String, focusMs: Long, breakMs: Long) {
        val title = if (running) "Focus  ${fmtHMS(focusMs)}" else "Break  ${fmtHMS(breakMs)}"
        val text = if (running) "Still focusing on $category?" else "Back to work?"
        val kind = if (running) MainActivity.REMINDER_FOCUS else MainActivity.REMINDER_BREAK

        // Opens the app and surfaces the redesigned dialog (full-screen + tap intent).
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_SHOW_REMINDER, kind)
        }
        val openPending = PendingIntent.getActivity(
            this, if (running) 11 else 12, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        // Snooze acts in place (no app open): the service pushes the next reminder out 10 minutes.
        val snoozeIntent = Intent(this, TimerForegroundService::class.java).apply { action = ACTION_SNOOZE }
        val snoozePending = PendingIntent.getService(
            this, 13, snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(this, REMINDER_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_timer)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openPending)
            .setFullScreenIntent(openPending, true)
            .addAction(R.drawable.ic_timer, "💤 10", snoozePending)
            .addAction(R.drawable.ic_timer, if (running) "OK" else "Back to work", openPending)

        notificationManager().notify(REMINDER_NOTIF_ID, builder.build())
    }

    private fun ensureChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = notificationManager()
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.timer_notification_channel),
                    NotificationManager.IMPORTANCE_LOW,
                )
            )
            // High importance so the reminder can heads-up / full-screen. We drive vibration
            // ourselves via vibrateCheckIn(), so disable the channel's own vibration to avoid a
            // double buzz.
            nm.createNotificationChannel(
                NotificationChannel(
                    REMINDER_CHANNEL_ID,
                    getString(R.string.reminder_notification_channel),
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply { enableVibration(false) }
            )
        }
    }

    private fun notificationManager() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    companion object {
        private const val CHANNEL_ID = "focuslog_timer"
        private const val REMINDER_CHANNEL_ID = "focuslog_reminder"
        private const val NOTIF_ID = 1001
        private const val REMINDER_NOTIF_ID = 1002
        private const val CHECKIN_SNOOZE_MS = 10 * 60 * 1000L

        const val ACTION_SNOOZE = "com.focuslog.wear.action.CHECKIN_SNOOZE"

        fun start(context: Context) {
            val intent = Intent(context, TimerForegroundService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TimerForegroundService::class.java))
        }
    }
}
