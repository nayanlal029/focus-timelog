package com.focuslog.wear.viewmodel

import android.app.Application
import android.content.Context
import android.os.VibrationEffect
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.focuslog.wear.auth.AuthManager
import com.focuslog.wear.data.BREAK_CATEGORY_ID
import com.focuslog.wear.data.BREAK_CATEGORY_NAME
import com.focuslog.wear.data.DISTRACTION_CATEGORY_ID
import com.focuslog.wear.data.DISTRACTION_CATEGORY_NAME
import com.focuslog.wear.data.Category
import com.focuslog.wear.data.CategoryType
import com.focuslog.wear.data.SupabaseRepository
import com.focuslog.wear.data.TimeBlockInsert
import com.focuslog.wear.data.WatchSettings
import com.focuslog.wear.data.local.ActiveStateEntity
import com.focuslog.wear.data.local.WatchDatabase
import com.focuslog.wear.service.ReminderBus
import com.focuslog.wear.service.TimerForegroundService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

enum class TimerPhase { IDLE, RUNNING, PAUSED }

data class Active(
    val categoryId: String,
    val categoryName: String,
    val type: CategoryType,
    val startedAt: Long,
    val runningSince: Long?,
    val breakStartedAt: Long?,
    val accumulatedBreakMs: Long,
    /** focusElapsed value at the start of the current Pomodoro work cycle (countdown baseline). */
    val pomodoroWorkBaseMs: Long = 0,
) {
    val phase: TimerPhase get() = if (runningSince != null) TimerPhase.RUNNING else TimerPhase.PAUSED

    fun focusElapsed(now: Long): Long {
        val end = breakStartedAt ?: now
        return (end - startedAt - accumulatedBreakMs).coerceAtLeast(0)
    }

    fun breakElapsed(now: Long): Long =
        breakStartedAt?.let { (now - it).coerceAtLeast(0) } ?: 0L
}

sealed interface WatchAlert {
    object PomodoroWorkDone : WatchAlert
    object PomodoroBreakDone : WatchAlert
    object FocusCheckIn : WatchAlert
    object BreakCheckIn : WatchAlert
}

private const val CHECKIN_SNOOZE_MS = 10 * 60 * 1000L

class TimerViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = SupabaseRepository(app)
    private val auth = AuthManager(app)
    private val db = WatchDatabase.get(app)
    private val settings = WatchSettings(app)

    // ── Categories ────────────────────────────────────────────────────────────

    val categories: StateFlow<List<Category>> =
        repo.observeCategories()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    // Pre-selected category: last used, fallback to first FOCUS, then first available
    val selectedCategory: StateFlow<Category?> = combine(
        categories,
        settings.lastCategoryId,
    ) { cats, lastId ->
        if (lastId != null) cats.find { it.id == lastId } else null
            ?: cats.firstOrNull { it.type == CategoryType.FOCUS }
            ?: cats.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    // ── Timer state ───────────────────────────────────────────────────────────

    private val _active = MutableStateFlow<Active?>(null)
    val active: StateFlow<Active?> = _active.asStateFlow()

    private val _now = MutableStateFlow(System.currentTimeMillis())
    val now: StateFlow<Long> = _now.asStateFlow()

    // ── Settings-backed flows ─────────────────────────────────────────────────

    val pomodoroEnabled: StateFlow<Boolean> =
        settings.pomodoroEnabled
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), true)

    val pomodoroWorkMin: StateFlow<Int> =
        settings.pomodoroWorkMin.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 25)

    val pomodoroBreakMin: StateFlow<Int> =
        settings.pomodoroBreakMin.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 5)

    val sleepAfterSec: StateFlow<Int> =
        settings.sleepAfterSec.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 8)

    val pomodoroWorkMs: StateFlow<Long> =
        settings.pomodoroWorkMin.map { it * 60_000L }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 25 * 60_000L)

    val pomodoroBreakMs: StateFlow<Long> =
        settings.pomodoroBreakMin.map { it * 60_000L }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 5 * 60_000L)

    val recentCategoryIds: StateFlow<List<String>> =
        settings.recentCategoryIds
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val checkInEnabled: StateFlow<Boolean> =
        settings.checkInEnabled.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), true)

    val checkInFocusMin: StateFlow<Int> =
        settings.checkInFocusMin.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 5)

    val checkInBreakMin: StateFlow<Int> =
        settings.checkInBreakMin.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 2)

    val checkInBuzzCount: StateFlow<Int> =
        settings.checkInBuzzCount.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 3)

    val checkInBuzzIntensity: StateFlow<Int> =
        settings.checkInBuzzIntensity.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 2)

    private val _isAmbient = MutableStateFlow(false)
    fun setAmbient(ambient: Boolean) { _isAmbient.value = ambient }

    // ── Sync diagnostics ──────────────────────────────────────────────────────
    // Surfaced on the Settings page so the user can confirm which account they're synced as
    // and whether any logged blocks are still waiting to upload.

    // Live queue depth — updates automatically as blocks upload, including when the background
    // SyncWorker drains them (same Room instance, so the observed query re-emits).
    val pendingCount: StateFlow<Int> =
        repo.observePendingCount()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    /** Wall-clock time of the last successful upload (0 = never). */
    val lastSyncedAt: StateFlow<Long> =
        settings.lastSyncedAt
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0L)

    private val _handle = MutableStateFlow<String?>(null)
    val handle: StateFlow<String?> = _handle.asStateFlow()

    fun signedInEmail(): String? = auth.currentEmail()
    fun signedInHandle(): String? = _handle.value

    /** Manual "Sync now": flush immediately; the reactive [pendingCount] reflects the result. */
    fun retrySync() {
        viewModelScope.launch { repo.flushPending() }
    }

    // ── Alerts ────────────────────────────────────────────────────────────────

    private val _alert = MutableSharedFlow<WatchAlert>(extraBufferCapacity = 2)
    val alert: SharedFlow<WatchAlert> = _alert.asSharedFlow()

    private var pomodoroWorkAlerted = false
    private var pomodoroBreakAlerted = false

    init {
        viewModelScope.launch { _handle.value = auth.fetchHandle() }
        // Check-in reminders are scheduled by TimerForegroundService (so they fire even when the
        // app/ViewModel is gone). Forward its events into our alert flow so the in-app dialog still
        // shows whenever the UI is open.
        viewModelScope.launch {
            ReminderBus.alerts.collect { _alert.tryEmit(it) }
        }
        viewModelScope.launch {
            db.activeStateDao().get()?.let { e ->
                _active.value = Active(
                    categoryId = e.categoryId,
                    categoryName = e.categoryName,
                    type = CategoryType.from(e.type),
                    startedAt = e.startedAt,
                    runningSince = e.runningSince,
                    breakStartedAt = e.breakStartedAt,
                    accumulatedBreakMs = e.accumulatedBreakMs,
                    pomodoroWorkBaseMs = e.pomodoroWorkBaseMs,
                )
                // Re-anchor the check-in interval to now so a stale timestamp can't fire instantly.
                settings.setCheckInLastAt(System.currentTimeMillis())
            }
        }
        viewModelScope.launch {
            repo.refreshCategories()
            val alreadySeeded = settings.defaultCategoriesSeeded.first()
            if (!alreadySeeded && db.categoryDao().getAll().isEmpty()) {
                val userId = auth.currentUserId()
                if (userId != null) {
                    repo.seedDefaultCategories(userId)
                    settings.markDefaultCategoriesSeeded()
                    repo.refreshCategories()
                }
            }
        }

        viewModelScope.launch {
            while (true) {
                val now = System.currentTimeMillis()
                _now.value = now
                checkAlerts(now)
                val delay = when {
                    _active.value == null -> 30_000L  // idle: no timer running, slow tick
                    _isAmbient.value      -> 15_000L  // ambient: saves CPU wake cycles
                    else                  -> 1_000L   // active + interactive: 1 s
                }
                kotlinx.coroutines.delay(delay)
            }
        }
    }

    // Pomodoro phase alerts only. Check-in reminders are owned by TimerForegroundService so they
    // fire even when the app is closed (see ReminderBus).
    private fun checkAlerts(now: Long) {
        val a = _active.value ?: run {
            pomodoroWorkAlerted = false
            pomodoroBreakAlerted = false
            return
        }

        if (a.phase == TimerPhase.PAUSED) {
            val breakMs = a.breakElapsed(now)
            // Pomodoro break done → vibrate 3× and start counting overflow as distraction
            if (pomodoroEnabled.value && !pomodoroBreakAlerted && breakMs >= pomodoroBreakMs.value) {
                pomodoroBreakAlerted = true
                _alert.tryEmit(WatchAlert.PomodoroBreakDone)
                vibrateTripleGroup()
            }
        } else {
            pomodoroBreakAlerted = false
        }

        if (pomodoroEnabled.value && a.phase == TimerPhase.RUNNING) {
            // Per-cycle countdown: only the focus accrued since this cycle began counts.
            val cycleFocus = a.focusElapsed(now) - a.pomodoroWorkBaseMs
            if (!pomodoroWorkAlerted && cycleFocus >= pomodoroWorkMs.value) {
                pomodoroWorkAlerted = true
                _alert.tryEmit(WatchAlert.PomodoroWorkDone)
                vibrate()
                // Auto-start the break (enters PAUSED, same mechanics as a manual pause)
                pause()
            }
        } else if (a.phase == TimerPhase.PAUSED) {
            pomodoroWorkAlerted = false
        }
    }

    // ── Timer actions ─────────────────────────────────────────────────────────

    fun startActivity(category: Category) {
        val now = System.currentTimeMillis()
        _now.value = now   // update clock immediately so timer screen shows 0:00 instantly
        _active.value = Active(
            categoryId = category.id,
            categoryName = category.name,
            type = category.type,
            startedAt = now,
            runningSince = now,
            breakStartedAt = null,
            accumulatedBreakMs = 0,
        )
        pomodoroWorkAlerted = false
        pomodoroBreakAlerted = false
        persist()
        TimerForegroundService.start(getApplication())
        vibrateSingle()
        viewModelScope.launch {
            settings.setCheckInLastAt(now)
            settings.setCheckInSnoozedUntil(0L)
            settings.setLastCategoryId(category.id)
            settings.pushRecentCategory(category.id)
        }
    }

    /** Hardware button 1 double-tap: start with selected category, or pause/resume if running. */
    fun toggleStartPause() {
        when (val a = _active.value) {
            null -> selectedCategory.value?.let { startActivity(it) }
            else -> if (a.phase == TimerPhase.RUNNING) pause() else resume()
        }
    }

    fun pause() {
        val a = _active.value ?: return
        if (a.phase != TimerPhase.RUNNING) return
        val now = System.currentTimeMillis()
        _active.value = a.copy(runningSince = null, breakStartedAt = now)
        // Restart the check-in interval at the pause moment so break reminders pace from "now".
        viewModelScope.launch { settings.setCheckInLastAt(now) }
        persist()
    }

    fun resume() {
        val a = _active.value ?: return
        if (a.phase != TimerPhase.PAUSED) return
        val now = System.currentTimeMillis()
        val breakStart = a.breakStartedAt ?: now
        queuePauseBlocks(breakStart, now)
        val resumed = a.copy(
            runningSince = now,
            breakStartedAt = null,
            accumulatedBreakMs = a.accumulatedBreakMs + (now - breakStart),
        )
        // Under Pomodoro, resuming starts a fresh work cycle: rebase the countdown to "now" so the
        // next 25-min session counts from zero, and re-arm the work alert.
        _active.value = if (pomodoroEnabled.value) {
            pomodoroWorkAlerted = false
            resumed.copy(pomodoroWorkBaseMs = resumed.focusElapsed(now))
        } else {
            resumed
        }
        pomodoroBreakAlerted = false
        viewModelScope.launch { settings.setCheckInLastAt(now) }
        persist()
    }

    fun stop() {
        val a = _active.value ?: return
        val now = System.currentTimeMillis()
        val activityEnd = a.breakStartedAt ?: now
        if (a.breakStartedAt != null) queuePauseBlocks(a.breakStartedAt, now)

        val userId = auth.lastKnownUserId()
        if (userId != null) {
            viewModelScope.launch {
                repo.saveBlock(
                    TimeBlockInsert(
                        id = UUID.randomUUID().toString(),
                        userId = userId,
                        categoryId = a.categoryId,
                        categoryName = a.categoryName,
                        type = a.type.wire,
                        startMs = a.startedAt,
                        endMs = activityEnd,
                        isBreak = false,
                    )
                )
            }
        }
        clearActive()
    }

    fun cancel() = clearActive()

    fun togglePomodoro() {
        viewModelScope.launch { settings.setPomodoroEnabled(!pomodoroEnabled.value) }
        pomodoroWorkAlerted = false
        pomodoroBreakAlerted = false
    }

    fun addCategory(name: String, type: CategoryType) {
        val userId = auth.currentUserId() ?: return
        viewModelScope.launch {
            repo.addCategory(name, type, userId)
            repo.refreshCategories()
        }
    }

    // ── Settings updates ──────────────────────────────────────────────────────

    fun updatePomodoroWork(min: Int)  { viewModelScope.launch { settings.setPomodoroWorkMin(min) } }
    fun updatePomodoroBreak(min: Int) { viewModelScope.launch { settings.setPomodoroBreakMin(min) } }
    fun updateSleepSec(sec: Int)      { viewModelScope.launch { settings.setSleepAfterSec(sec) } }

    fun toggleCheckIn()                 { viewModelScope.launch { settings.setCheckInEnabled(!checkInEnabled.value) } }
    fun updateCheckInFocusMin(min: Int) { viewModelScope.launch { settings.setCheckInFocusMin(min) } }
    fun updateCheckInBreakMin(min: Int) { viewModelScope.launch { settings.setCheckInBreakMin(min) } }
    fun updateCheckInBuzzCount(n: Int)  { viewModelScope.launch { settings.setCheckInBuzzCount(n) } }
    /** Cycle Light → Medium → Strong → Light. */
    fun cycleCheckInBuzzIntensity()     { viewModelScope.launch { settings.setCheckInBuzzIntensity((checkInBuzzIntensity.value + 1) % 3) } }

    /** Suppress check-in reminders for 10 minutes; the next one fires 10 min from now. */
    fun snoozeCheckIn() {
        val now = System.currentTimeMillis()
        viewModelScope.launch {
            settings.setCheckInSnoozedUntil(now + CHECKIN_SNOOZE_MS)
            settings.setCheckInLastAt(now)
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * Log the time spent in a pause. Normally one neutral "Break" block. Under Pomodoro, time past
     * the configured break window is split off as a separate **distraction** block so overflow
     * (ignoring the "get back to focus" nudge) is counted honestly.
     */
    private fun queuePauseBlocks(start: Long, end: Long) {
        if (end <= start) return
        val breakWindow = pomodoroBreakMs.value
        if (pomodoroEnabled.value && (end - start) > breakWindow) {
            val breakEnd = start + breakWindow
            queueBlock(BREAK_CATEGORY_ID, BREAK_CATEGORY_NAME, CategoryType.NEUTRAL, start, breakEnd, isBreak = true)
            queueBlock(DISTRACTION_CATEGORY_ID, DISTRACTION_CATEGORY_NAME, CategoryType.DISTRACTION, breakEnd, end, isBreak = false)
        } else {
            queueBlock(BREAK_CATEGORY_ID, BREAK_CATEGORY_NAME, CategoryType.NEUTRAL, start, end, isBreak = true)
        }
    }

    private fun queueBlock(
        categoryId: String,
        categoryName: String,
        type: CategoryType,
        start: Long,
        end: Long,
        isBreak: Boolean,
    ) {
        if (end <= start) return
        val userId = auth.lastKnownUserId() ?: return
        viewModelScope.launch {
            repo.saveBlock(
                TimeBlockInsert(
                    id = UUID.randomUUID().toString(),
                    userId = userId,
                    categoryId = categoryId,
                    categoryName = categoryName,
                    type = type.wire,
                    startMs = start,
                    endMs = end,
                    isBreak = isBreak,
                )
            )
        }
    }

    private fun clearActive() {
        _active.value = null
        pomodoroWorkAlerted = false
        pomodoroBreakAlerted = false
        viewModelScope.launch {
            settings.setCheckInLastAt(0L)
            settings.setCheckInSnoozedUntil(0L)
            db.activeStateDao().clear()
        }
        TimerForegroundService.stop(getApplication())
    }

    private fun persist() {
        val a = _active.value ?: return
        viewModelScope.launch {
            db.activeStateDao().put(
                ActiveStateEntity(
                    categoryId = a.categoryId,
                    categoryName = a.categoryName,
                    type = a.type.wire,
                    startedAt = a.startedAt,
                    accumulatedMs = 0,
                    runningSince = a.runningSince,
                    breakStartedAt = a.breakStartedAt,
                    accumulatedBreakMs = a.accumulatedBreakMs,
                    pomodoroWorkBaseMs = a.pomodoroWorkBaseMs,
                )
            )
        }
    }

    /** Two-pulse vibration — used for alerts. */
    private fun vibrate() {
        runCatching {
            val vm = getApplication<Application>()
                .getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(
                VibrationEffect.createWaveform(longArrayOf(0, 300, 100, 300), -1)
            )
        }
    }

    /** 3×3×3 vibration: three groups of three short pulses, 1 s gap between groups. */
    private fun vibrateTripleGroup() {
        runCatching {
            val pulse   = longArrayOf(0, 150, 80, 150, 80, 150)
            val gap     = longArrayOf(1_000)
            val pattern = pulse + gap + pulse + gap + pulse
            val vm = getApplication<Application>()
                .getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        }
    }

    /** Single short pulse — used on timer start. */
    private fun vibrateSingle() {
        runCatching {
            val vm = getApplication<Application>()
                .getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(
                VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE)
            )
        }
    }
}
