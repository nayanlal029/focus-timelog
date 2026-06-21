package com.focuslog.wear.data

import android.content.Context
import android.util.Log
import com.focuslog.wear.data.local.CategoryEntity
import com.focuslog.wear.data.local.PendingBlockEntity
import com.focuslog.wear.data.local.WatchDatabase
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

class SupabaseRepository(context: Context) {

    private val appContext = context.applicationContext
    private val db = WatchDatabase.get(appContext)
    private val client = SupabaseProvider.client

    // ── Categories ────────────────────────────────────────────────────────────

    fun observeCategories(): Flow<List<Category>> =
        db.categoryDao().observeAll().map { rows ->
            rows.map { Category(it.id, it.name, CategoryType.from(it.type), it.order) }
        }

    suspend fun refreshCategories(): Result<Unit> = runCatching {
        val rows = client.from("categories")
            .select()
            .decodeList<CategoryRow>()
        val entities = rows.map { CategoryEntity(it.id, it.name, it.type, it.order) }
        db.categoryDao().upsertAll(entities)
        if (entities.isNotEmpty()) db.categoryDao().deleteMissing(entities.map { it.id })
    }

    suspend fun addCategory(name: String, type: CategoryType, userId: String): Result<Category> =
        runCatching {
            val id = UUID.randomUUID().toString()
            val maxOrder = db.categoryDao().getAll().maxOfOrNull { it.order } ?: 0
            val insert = CategoryInsert(
                id = id,
                userId = userId,
                name = name,
                type = type.wire,
                order = maxOrder + 1,
            )
            client.from("categories").insert(insert)
            val entity = CategoryEntity(id, name, type.wire, maxOrder + 1)
            db.categoryDao().upsertAll(listOf(entity))
            Category(id, name, type, maxOrder + 1)
        }

    // ── Time blocks ───────────────────────────────────────────────────────────

    /**
     * Queue-first save: the block is durable the moment it is written to Room.
     * [flushPending] then attempts an immediate upload.
     */
    suspend fun saveBlock(block: TimeBlockInsert) {
        db.pendingBlockDao().insert(block.toPending())
        flushPending()
        // Whatever didn't upload immediately (offline, token not ready yet, transient error)
        // must be retried in the background — otherwise it would sit in the queue forever.
        if (db.pendingBlockDao().count() > 0) SyncWorker.enqueue(appContext)
    }

    /** Flush queued blocks to Supabase. Stops at first failure (retry by SyncWorker). */
    suspend fun flushPending(): Result<Int> = runCatching {
        val pending = db.pendingBlockDao().getAll()
        Log.i(TAG, "flushPending: ${pending.size} block(s) queued")
        var sent = 0
        for (p in pending) {
            try {
                // upsert (not insert) so a block that already reached Supabase — e.g. recovered
                // manually, or inserted on a previous run whose local delete didn't land — is a
                // harmless no-op on its (user_id, id) primary key instead of a duplicate-key error
                // that would wedge the whole queue.
                client.from("time_blocks").upsert(p.toInsert())
                db.pendingBlockDao().delete(p.id)
                sent++
            } catch (e: Exception) {
                // Surface *why* an upload failed (bad config / DNS, auth-RLS 401, enum, …) so it is
                // diagnosable via `adb logcat -s FocusLogSync` instead of failing silently.
                Log.w(TAG, "Upload failed for block ${p.id} (user=${p.userId}): ${e.message}", e)
                throw e  // bubble up so SyncWorker schedules a retry; rest stay queued
            }
        }
        Log.i(TAG, "flushPending: sent $sent, ${db.pendingBlockDao().count()} still queued")
        sent
    }

    suspend fun pendingCount(): Int = db.pendingBlockDao().count()

    // ── Summary (read-only, 24 h / 7 d) ──────────────────────────────────────

    suspend fun fetchSummary(startMs: Long): Result<List<TimeBlockRow>> = runCatching {
        client.from("time_blocks")
            .select {
                filter {
                    gte("start_ms", startMs)
                    eq("is_break", false)
                }
                order("start_ms", Order.DESCENDING)
            }
            .decodeList<TimeBlockRow>()
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private fun TimeBlockInsert.toPending() = PendingBlockEntity(
        id = id, userId = userId, categoryId = categoryId, categoryName = categoryName,
        type = type, startMs = startMs, endMs = endMs, isBreak = isBreak,
    )

    private fun PendingBlockEntity.toInsert() = TimeBlockInsert(
        id = id, userId = userId, categoryId = categoryId, categoryName = categoryName,
        type = type, startMs = startMs, endMs = endMs, isBreak = isBreak,
    )

    private companion object {
        const val TAG = "FocusLogSync"
    }
}
