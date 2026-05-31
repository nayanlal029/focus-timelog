package com.focuslog.wear.data

import android.content.Context
import com.focuslog.wear.data.local.CategoryEntity
import com.focuslog.wear.data.local.PendingBlockEntity
import com.focuslog.wear.data.local.WatchDatabase
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

class SupabaseRepository(context: Context) {

    private val db = WatchDatabase.get(context)
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

    suspend fun addCategory(
        name: String,
        type: CategoryType,
        userId: String,
        order: Int? = null,
    ): Result<Category> = runCatching {
        val id = UUID.randomUUID().toString()
        val effectiveOrder = order ?: ((db.categoryDao().getAll().maxOfOrNull { it.order } ?: 0) + 1)
        val insert = CategoryInsert(
            id = id,
            userId = userId,
            name = name,
            type = type.wire,
            order = effectiveOrder,
        )
        client.from("categories").insert(insert)
        val entity = CategoryEntity(id, name, type.wire, effectiveOrder)
        db.categoryDao().upsertAll(listOf(entity))
        Category(id, name, type, effectiveOrder)
    }

    suspend fun seedDefaultCategories(userId: String) {
        val defaults = listOf(
            "Work"          to CategoryType.FOCUS,
            "Study"         to CategoryType.FOCUS,
            "Exercise"      to CategoryType.FOCUS,
            "Personal"      to CategoryType.FOCUS,
            "Break / Lunch" to CategoryType.NEUTRAL,
            "Social"        to CategoryType.NEUTRAL,
        )
        defaults.forEachIndexed { index, (name, type) ->
            addCategory(name, type, userId, order = index + 1)
        }
    }

    // ── Time blocks ───────────────────────────────────────────────────────────

    /**
     * Queue-first save: the block is durable the moment it is written to Room.
     * [flushPending] then attempts an immediate upload.
     */
    suspend fun saveBlock(block: TimeBlockInsert) {
        db.pendingBlockDao().insert(block.toPending())
        flushPending()
    }

    /** Flush queued blocks to Supabase. Stops at first failure (retry by SyncWorker). */
    suspend fun flushPending(): Result<Int> = runCatching {
        var sent = 0
        for (p in db.pendingBlockDao().getAll()) {
            val ok = runCatching {
                client.from("time_blocks").insert(p.toInsert())
            }.isSuccess
            if (ok) {
                db.pendingBlockDao().delete(p.id)
                sent++
            } else {
                break  // leave remaining in queue for SyncWorker to retry
            }
        }
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
}
