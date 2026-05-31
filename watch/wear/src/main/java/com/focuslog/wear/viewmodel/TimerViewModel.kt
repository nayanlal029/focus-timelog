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
import com.focuslog.wear.data.WatchSettings
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
import kotlinx.coroutines.flow.combine
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
    object DistractionThreshold : WatchAlert
    object PomodoroWorkDone : WatchAlert
    object PomodoroBreakDone : WatchAlert
}

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

    private val _pomodoroEnabled = MutableStateFlow(false)
    val pomodoroEnabled: StateFlow<Boolean> = _pomodoroEnabled.asStateFlow()

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

    // ── Alerts ────────────────────────────────────────────────────────────────

    private val _alert = MutableSharedFlow<WatchAlert>(extraBufferCapacity = 2)
    val alert: SharedFlow<WatchAlert> = _alert.asSharedFlow()

    val distractionThresholdMs: Long = 5 * 60 * 1000L

    private var distractionAlerted = false
    private var pomodoroWorkAlerted = false
    private var pomodoroBreakAlerted = false

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
            pomodoroBreakAlerted = false
            return
        }

        if (a.phase == TimerPhase.PAUSED) {
            val breakMs = a.breakElapsed(now)
            // Distraction threshold (non-Pomodoro)
            if (!distractionAlerted && breakMs >= distractionThresholdMs) {
                distractionAlerted = true
                _alert.tryEmit(WatchAlert.DistractionThreshold)
                vibrate()
            }
            // Pomodoro break done
            if (_pomodoroEnabled.value && !pomodoroBreakAlerted && breakMs >= pomodoroBreakMs.value) {
                pomodoroBreakAlerted = true
                _alert.tryEmit(WatchAlert.PomodoroBreakDone)
                vibrate()
            }
        } else {
            distractionAlerted = false
            pomodoroBreakAlerted = false
        }

        if (_pomodoroEnabled.value && a.phase == TimerPhase.RUNNING) {
            val focus = a.focusElapsed(now)
            if (!pomodoroWorkAlerted && focus >= pomodoroWorkMs.value) {
                pomodoroWorkAlerted = true
                _alert.tryEmit(WatchAlert.PomodoroWorkDone)
                vibrate()
            }
        } else if (a.phase == TimerPhase.PAUSED) {
            pomodoroWorkAlerted = false
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
        pomodoroBreakAlerted = false
        distractionAlerted = false
        persist()
        TimerForegroundService.start(getApplication())
        vibrateSingle()
        viewModelScope.launch { settings.setLastCategoryId(category.id) }
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
        pomodoroBreakAlerted = false
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
        pomodoroBreakAlerted = false
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
