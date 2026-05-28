package com.focuslog.wear.viewmodel

import android.app.Application
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

enum class TimerPhase { IDLE, RUNNING, PAUSED }

/** Snapshot consumed by the UI. Elapsed values are recomputed each tick from [active]. */
data class Active(
    val categoryId: String,
    val categoryName: String,
    val type: CategoryType,
    val startedAt: Long,
    val runningSince: Long?,        // null => paused
    val breakStartedAt: Long?,      // set while paused
    val accumulatedBreakMs: Long,   // sum of completed breaks
) {
    val phase: TimerPhase get() = if (runningSince != null) TimerPhase.RUNNING else TimerPhase.PAUSED

    fun focusElapsed(now: Long): Long {
        val end = breakStartedAt ?: now
        return (end - startedAt - accumulatedBreakMs).coerceAtLeast(0)
    }

    fun breakElapsed(now: Long): Long =
        breakStartedAt?.let { (now - it).coerceAtLeast(0) } ?: 0L
}

class TimerViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = SupabaseRepository(app)
    private val auth = AuthManager(app)
    private val db = WatchDatabase.get(app)

    val categories: StateFlow<List<Category>> =
        repo.observeCategories().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _active = MutableStateFlow<Active?>(null)
    val active: StateFlow<Active?> = _active.asStateFlow()

    /** Ticks once a second to drive the elapsed-time display. */
    private val _now = MutableStateFlow(System.currentTimeMillis())
    val now: StateFlow<Long> = _now.asStateFlow()

    init {
        // Restore any in-flight timer that survived process death.
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
        // Keep categories fresh from Supabase.
        viewModelScope.launch { repo.refreshCategories() }
        // Drive the clock.
        viewModelScope.launch {
            while (true) {
                _now.value = System.currentTimeMillis()
                kotlinx.coroutines.delay(1_000)
            }
        }
    }

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
        persist()
        TimerForegroundService.start(getApplication())
    }

    /** Pause the stopwatch — this is where the break/distraction timer begins. */
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
        // Close the break as its own block so the web app shows the gap.
        queueBreakBlock(breakStart, now)
        _active.value = a.copy(
            runningSince = now,
            breakStartedAt = null,
            accumulatedBreakMs = a.accumulatedBreakMs + (now - breakStart),
        )
        persist()
    }

    fun stop() {
        val a = _active.value ?: return
        val now = System.currentTimeMillis()
        // If paused at stop, the activity ended when the pause began; close the trailing break too.
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

    /** Discard the running timer without logging anything. */
    fun cancel() = clearActive()

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
}
