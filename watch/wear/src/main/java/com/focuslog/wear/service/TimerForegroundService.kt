package com.focuslog.wear.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.focuslog.wear.R
import com.focuslog.wear.data.local.WatchDatabase
import com.focuslog.wear.util.fmtHMS
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Keeps the active timer alive (and visible as an ongoing notification) when the app is
 * backgrounded — e.g. the user lowers their wrist or presses the home crown. The notification
 * elapsed time is recomputed from the persisted ActiveState so it stays correct across restarts.
 */
class TimerForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.Main)
    private var ticker: Job? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        startForeground(NOTIF_ID, buildNotification("Focus", 0))
        ticker = scope.launch {
            val dao = WatchDatabase.get(applicationContext).activeStateDao()
            while (true) {
                val state = dao.get()
                if (state == null) { stopSelf(); break }
                val now = System.currentTimeMillis()
                val end = state.breakStartedAt ?: now
                val elapsed = (end - state.startedAt - state.accumulatedBreakMs).coerceAtLeast(0)
                notificationManager().notify(NOTIF_ID, buildNotification(state.categoryName, elapsed))
                delay(1_000)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        ticker?.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(title: String, elapsedMs: Long): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_timer)
            .setContentTitle(title)
            .setContentText(fmtHMS(elapsedMs))
            .setOngoing(true)
            .setSilent(true)
            .build()

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.timer_notification_channel),
                NotificationManager.IMPORTANCE_LOW,
            )
            notificationManager().createNotificationChannel(channel)
        }
    }

    private fun notificationManager() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    companion object {
        private const val CHANNEL_ID = "focuslog_timer"
        private const val NOTIF_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, TimerForegroundService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TimerForegroundService::class.java))
        }
    }
}
