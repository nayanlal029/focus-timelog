package com.focuslog.wear.service

import com.focuslog.wear.viewmodel.WatchAlert
import kotlinx.coroutines.flow.MutableSharedFlow

/**
 * Process-wide channel for check-in reminders. The [TimerForegroundService] owns the reminder
 * schedule (so reminders fire even when the app UI is gone) and emits here; [TimerViewModel]
 * collects and forwards to its `alert` flow so the in-app dialog still shows when the app is open.
 */
object ReminderBus {
    val alerts = MutableSharedFlow<WatchAlert>(extraBufferCapacity = 4)
}

/**
 * Tracks whether the watch UI is currently in the foreground. Set from `MainActivity`'s
 * onStart/onStop. The service reads it to decide between showing the in-app dialog (foreground)
 * and posting a heads-up reminder notification (background).
 */
object AppForeground {
    @Volatile
    var value: Boolean = false
}
