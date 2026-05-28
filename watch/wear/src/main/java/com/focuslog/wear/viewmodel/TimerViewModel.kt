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
import com.focuslog.wear.data.Category
import com.focuslog.wear.data.CategoryType
import com.focuslog.wear.data.SupabaseRepository
import com.focuslog.wear.data.TimeBlockInsert
import com.focuslog.wear.data.local.ActiveStateEntity
import com.focuslog.wear.data.local.WatchDatabase
import com.focuslog.wear.service.TimerForegroundService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
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
) {
    val phase: TimerPhase get() = if (runningSince != null) TimerPhase.RUNNING else TimerPhase.PAUSED

    fun focusElapsed(now: Long): Long {
        val end = breakStartedAt ?: now
        return (end - startedAt - accumulatedBreakMs).coerceAtLeast(0)
    }

    fun breakElapsed(now: Long): Long =
        breakStartedAt?.let { (now - it).coerceAtLeast(0) } ?: 0L
}

// ── Alert events ──────────────────────────────────────────────────────────────

sealed interface WatchAlert {
    /** Break has exceeded the distraction threshold. */
    object DistractionThreshold : WatchAlert
    /** Pomodoro work session is done — time for a break. */
    object PomodoroWorkDone : WatchAlert
    /** Pomodoro break is over — time to focus again. */
    object PomodoroBreakDone : WatchAlert
}

class TimerViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = SupabaseRepository(app)
    private val auth = AuthManager(app)
    private val db = WatchDatabase.get(app)

    val categories: StateFlow<List<Category>> =
        repo.observeCategories()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _active = MutableStateFlow<Active?>(null)
    val active: StateFlow<Active?> = _active.asStateFlow()

    private val _now = MutableStateFlow(System.currentTimeMillis())
    val now: StateFlow<Long> = _now.asStateFlow()

    // ── Pomodoro ──────────────────────────────────────────────────────────────
    private val _pomodoroEnabled = MutableStateFlow(false)
    val pomodoroEnabled: StateFlow<Boolean> = _pomodoroEnabled.asStateFlow()

    /** Configurable work duration. Default 25 min. */
    val pomodoroWorkMs: Long = 25 * 60 * 1000L

    // ── Alerts ────────────────────────────────────────────────────────────────
    private val _alert = MutableSharedFlow<WatchAlert>(extraBufferCapacity = 2)
    val alert: SharedFlow<WatchAlert> = _alert.asSharedFlow()

    /** Distraction threshold (default 5 min). Fires once per continuous pause. */
    var distractionThresholdMs: Long = 5 * 60 * 1000L

    private var distractionAlerted = false
    private var pomodoroWorkAlerted = false

    init {
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
                )
            }
        }
        viewModelScope.launch { repo.refreshCategories() }

        // Clock + alert checker — 1 s tick
        viewModelScope.launch {
            while (true) {
                val now = System.currentTimeMillis()
                _now.value = now
                checkAlerts(now)
                kotlinx.coroutines.delay(1_000)
            }
        }
    }

    private fun checkAlerts(now: Long) {
        val a = _active.value ?: run {
            distractionAlerted = false
            pomodoroWorkAlerted = false
            return
        }

        // Distraction alert: fires once when a continuous break crosses the threshold
        if (a.phase == TimerPhase.PAUSED) {
            val breakMs = a.breakElapsed(now)
            if (!distractionAlerted && breakMs >= distractionThresholdMs) {
                distractionAlerted = true
                _alert.tryEmit(WatchAlert.DistractionThreshold)
                vibrate()
            }
        } else {
            distractionAlerted = false  // reset after resuming
        }

        // Pomodoro work-done alert
        if (_pomodoroEnabled.value && a.phase == TimerPhase.RUNNING) {
            val focus = a.focusElapsed(now)
            if (!pomodoroWorkAlerted && focus >= pomodoroWorkMs) {
                pomodoroWorkAlerted = true
                _alert.tryEmit(WatchAlert.PomodoroWorkDone)
                vibrate()
            }
        }
    }

    // ── Timer actions ─────────────────────────────────────────────────────────

    fun startActivity(category: Category) {
        val now = System.currentTimeMillis()
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
        distractionAlerted = false
        persist()
        TimerForegroundService.start(getApplication())
    }

    fun pause() {
        val a = _active.value ?: return
        if (a.phase != TimerPhase.RUNNING) return
        val now = System.currentTimeMillis()
        _active.value = a.copy(runningSince = null, breakStartedAt = now)
        persist()
    }

    fun resume() {
        val a = _active.value ?: return
        if (a.phase != TimerPhase.PAUSED) return
        val now = System.currentTimeMillis()
        val breakStart = a.breakStartedAt ?: now
        queueBreakBlock(breakStart, now)
        _active.value = a.copy(
            runningSince = now,
            breakStartedAt = null,
            accumulatedBreakMs = a.accumulatedBreakMs + (now - breakStart),
        )
        distractionAlerted = false
        persist()
    }

    fun stop() {
        val a = _active.value ?: return
        val now = System.currentTimeMillis()
        val activityEnd = a.breakStartedAt ?: now
        if (a.breakStartedAt != null) queueBreakBlock(a.breakStartedAt, now)

        val userId = auth.currentUserId()
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
        _pomodoroEnabled.value = !_pomodoroEnabled.value
        pomodoroWorkAlerted = false
    }

    fun addCategory(name: String, type: CategoryType) {
        val userId = auth.currentUserId() ?: return
        viewModelScope.launch {
            repo.addCategory(name, type, userId)
            // Room cache is updated inside addCategory; Flow will emit the new list automatically.
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private fun queueBreakBlock(start: Long, end: Long) {
        if (end <= start) return
        val userId = auth.currentUserId() ?: return
        viewModelScope.launch {
            repo.saveBlock(
                TimeBlockInsert(
                    id = UUID.randomUUID().toString(),
                    userId = userId,
                    categoryId = BREAK_CATEGORY_ID,
                    categoryName = BREAK_CATEGORY_NAME,
                    type = CategoryType.NEUTRAL.wire,
                    startMs = start,
                    endMs = end,
                    isBreak = true,
                )
            )
        }
    }

    private fun clearActive() {
        _active.value = null
        pomodoroWorkAlerted = false
        distractionAlerted = false
        viewModelScope.launch { db.activeStateDao().clear() }
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
                )
            )
        }
    }

    private fun vibrate() {
        runCatching {
            val vm = getApplication<Application>()
                .getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(
                VibrationEffect.createWaveform(longArrayOf(0, 300, 100, 300), -1)
            )
        }
    }
}
