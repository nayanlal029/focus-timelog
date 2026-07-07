package com.focuslog.mobile.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.focuslog.core.auth.AuthManager
import com.focuslog.core.data.BREAK_CATEGORY_ID
import com.focuslog.core.data.BREAK_CATEGORY_NAME
import com.focuslog.core.data.Category
import com.focuslog.core.data.CategoryType
import com.focuslog.core.data.SupabaseRepository
import com.focuslog.core.data.TimeBlockFull
import com.focuslog.core.data.TimeBlockInsert
import com.focuslog.core.data.TimeBlockUpdate
import com.focuslog.core.data.WatchSettings
import com.focuslog.core.data.local.ActiveStateEntity
import com.focuslog.core.data.local.WatchDatabase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.UUID

enum class TimerPhase { RUNNING, PAUSED }

data class ActiveTimer(
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

/**
 * Phone timer: same block-writing semantics as the watch (focus block on stop, neutral
 * `is_break` block per pause) minus the wear-only extras (Pomodoro auto-break, vibration
 * check-ins). Both devices write to the same `time_blocks` table via the shared offline queue.
 */
class MobileTimerViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = SupabaseRepository(app)
    private val auth = AuthManager(app)
    private val db = WatchDatabase.get(app)
    private val settings = WatchSettings(app)

    // ── Categories ────────────────────────────────────────────────────────────

    val categories: StateFlow<List<Category>> =
        repo.observeCategories()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    // ── Timer state ───────────────────────────────────────────────────────────

    private val _active = MutableStateFlow<ActiveTimer?>(null)
    val active: StateFlow<ActiveTimer?> = _active.asStateFlow()

    private val _now = MutableStateFlow(System.currentTimeMillis())
    val now: StateFlow<Long> = _now.asStateFlow()

    // ── Today's blocks (list + edit) ──────────────────────────────────────────

    private val _todayBlocks = MutableStateFlow<List<TimeBlockFull>>(emptyList())
    val todayBlocks: StateFlow<List<TimeBlockFull>> = _todayBlocks.asStateFlow()

    private val _loadingBlocks = MutableStateFlow(false)
    val loadingBlocks: StateFlow<Boolean> = _loadingBlocks.asStateFlow()

    // Live queue depth — re-emits as blocks upload, including from the background SyncWorker.
    val pendingCount: StateFlow<Int> =
        repo.observePendingCount()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    init {
        viewModelScope.launch {
            db.activeStateDao().get()?.let { e ->
                _active.value = ActiveTimer(
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
        refreshToday()
        viewModelScope.launch {
            while (true) {
                _now.value = System.currentTimeMillis()
                kotlinx.coroutines.delay(if (_active.value == null) 30_000L else 1_000L)
            }
        }
    }

    // ── Timer actions (same semantics as the watch TimerViewModel) ───────────

    fun start(category: Category) {
        val now = System.currentTimeMillis()
        _now.value = now
        _active.value = ActiveTimer(
            categoryId = category.id,
            categoryName = category.name,
            type = category.type,
            startedAt = now,
            runningSince = now,
            breakStartedAt = null,
            accumulatedBreakMs = 0,
        )
        persist()
    }

    fun pause() {
        val a = _active.value ?: return
        if (a.phase != TimerPhase.RUNNING) return
        _active.value = a.copy(runningSince = null, breakStartedAt = System.currentTimeMillis())
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
        persist()
    }

    fun stop() {
        val a = _active.value ?: return
        val now = System.currentTimeMillis()
        val activityEnd = a.breakStartedAt ?: now
        if (a.breakStartedAt != null) queueBreakBlock(a.breakStartedAt, now)

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
                refreshToday()
            }
        }
        _active.value = null
        viewModelScope.launch { db.activeStateDao().clear() }
    }

    fun cancel() {
        _active.value = null
        viewModelScope.launch { db.activeStateDao().clear() }
    }

    fun addCategory(name: String, type: CategoryType) {
        val userId = auth.currentUserId() ?: return
        viewModelScope.launch {
            repo.addCategory(name, type, userId)
            repo.refreshCategories()
        }
    }

    // ── Today list / edit ─────────────────────────────────────────────────────

    fun refreshToday() {
        viewModelScope.launch {
            _loadingBlocks.value = true
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }
            val dayStart = cal.timeInMillis
            cal.add(Calendar.DAY_OF_MONTH, 1)
            val dayEnd = cal.timeInMillis
            repo.fetchBlocksBetween(dayStart, dayEnd).onSuccess { _todayBlocks.value = it }
            _loadingBlocks.value = false
        }
    }

    fun updateBlockTimes(block: TimeBlockFull, newStartMs: Long, newEndMs: Long) {
        if (newEndMs <= newStartMs) return
        viewModelScope.launch {
            repo.updateBlock(block.id, TimeBlockUpdate(startMs = newStartMs, endMs = newEndMs))
            refreshToday()
        }
    }

    fun updateBlockCategory(block: TimeBlockFull, category: Category) {
        viewModelScope.launch {
            repo.updateBlock(
                block.id,
                TimeBlockUpdate(
                    categoryId = category.id,
                    categoryName = category.name,
                    type = category.type.wire,
                ),
            )
            refreshToday()
        }
    }

    fun deleteBlock(block: TimeBlockFull) {
        viewModelScope.launch {
            repo.deleteBlock(block.id)
            refreshToday()
        }
    }

    // ── Sync diagnostics ──────────────────────────────────────────────────────

    fun retrySync() {
        viewModelScope.launch { repo.flushPending() }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private fun queueBreakBlock(start: Long, end: Long) {
        if (end <= start) return
        val userId = auth.lastKnownUserId() ?: return
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
