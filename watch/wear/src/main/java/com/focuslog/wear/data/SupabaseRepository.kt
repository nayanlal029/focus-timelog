package com.focuslog.wear.data

import android.content.Context
import com.focuslog.wear.data.local.CategoryEntity
import com.focuslog.wear.data.local.PendingBlockEntity
import com.focuslog.wear.data.local.WatchDatabase
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Reads categories from Supabase (cached in Room for offline use) and writes time_blocks.
 * Writes go through a local queue first so nothing is lost when the watch is offline.
 */
class SupabaseRepository(context: Context) {

    private val db = WatchDatabase.get(context)
    private val client = SupabaseProvider.client

    /** Offline-first: UI observes the Room cache; [refreshCategories] keeps it fresh. */
    fun observeCategories(): Flow<List<Category>> =
        db.categoryDao().observeAll().map { rows ->
            rows.map { Category(it.id, it.name, CategoryType.from(it.type), it.order) }
        }

    /** Pull categories from Supabase into the local cache. Safe to call on every launch/foreground. */
    suspend fun refreshCategories(): Result<Unit> = runCatching {
        val rows = client.from("categories")
            .select()
            .decodeList<CategoryRow>()
        val entities = rows.map { CategoryEntity(it.id, it.name, it.type, it.order) }
        db.categoryDao().upsertAll(entities)
        db.categoryDao().deleteMissing(entities.map { it.id })
    }

    /**
     * Queue a block and immediately try to flush. The block is durable the moment it is queued;
     * if the network insert fails it stays queued for [flushPending] / SyncWorker to retry.
     */
    suspend fun saveBlock(block: TimeBlockInsert) {
        db.pendingBlockDao().insert(block.toPending())
        flushPending()
    }

    /** Attempt to upload every queued block. Successful rows are removed from the queue. */
    suspend fun flushPending(): Result<Int> = runCatching {
        val pending = db.pendingBlockDao().getAll()
        var sent = 0
        for (p in pending) {
            runCatching {
                client.from("time_blocks").insert(p.toInsert())
                db.pendingBlockDao().delete(p.id)
                sent++
            }.onFailure { return@runCatching sent } // stop on first failure; retry later
        }
        sent
    }

    suspend fun pendingCount(): Int = db.pendingBlockDao().count()

    private fun TimeBlockInsert.toPending() = PendingBlockEntity(
        id = id, userId = userId, categoryId = categoryId, categoryName = categoryName,
        type = type, startMs = startMs, endMs = endMs, isBreak = isBreak,
    )

    private fun PendingBlockEntity.toInsert() = TimeBlockInsert(
        id = id, userId = userId, categoryId = categoryId, categoryName = categoryName,
        type = type, startMs = startMs, endMs = endMs, isBreak = isBreak,
    )
}
