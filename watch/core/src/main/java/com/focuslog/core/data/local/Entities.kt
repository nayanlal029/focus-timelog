package com.focuslog.core.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Cached copy of the user's categories so the picker works offline. */
@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val type: String,
    val order: Int,
)

/**
 * A logged block waiting to be written to Supabase. Rows are inserted here first (and on insert
 * failure), then flushed by [com.focuslog.core.data.SyncWorker]. Mirrors the `time_blocks` insert
 * shape exactly.
 */
@Entity(tableName = "pending_blocks")
data class PendingBlockEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val categoryId: String,
    val categoryName: String,
    val type: String,
    val startMs: Long,
    val endMs: Long,
    val isBreak: Boolean,
)

/**
 * The single in-flight timer, persisted so it survives process death. Mirrors the web app's
 * `ActiveState` (categoryId, startedAt, accumulatedMs, runningSince, breakStartedAt).
 * `runningSince == null` means paused.
 */
@Entity(tableName = "active_state")
data class ActiveStateEntity(
    @PrimaryKey val singleton: Int = 0,
    val categoryId: String,
    val categoryName: String,
    val type: String,
    val startedAt: Long,
    val accumulatedMs: Long,
    val runningSince: Long?,
    val breakStartedAt: Long?,
    val accumulatedBreakMs: Long,
    /** focusElapsed value at the start of the current Pomodoro work cycle (countdown baseline). */
    val pomodoroWorkBaseMs: Long = 0,
)
