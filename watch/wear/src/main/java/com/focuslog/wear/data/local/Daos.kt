package com.focuslog.wear.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY `order` ASC, name ASC")
    fun observeAll(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories ORDER BY `order` ASC, name ASC")
    suspend fun getAll(): List<CategoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<CategoryEntity>)

    @Query("DELETE FROM categories WHERE id NOT IN (:keepIds)")
    suspend fun deleteMissing(keepIds: List<String>)
}

@Dao
interface PendingBlockDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(block: PendingBlockEntity)

    @Query("SELECT * FROM pending_blocks ORDER BY startMs ASC")
    suspend fun getAll(): List<PendingBlockEntity>

    @Query("DELETE FROM pending_blocks WHERE id = :id")
    suspend fun delete(id: String)

    @Query("SELECT COUNT(*) FROM pending_blocks")
    suspend fun count(): Int
}

@Dao
interface ActiveStateDao {
    @Query("SELECT * FROM active_state WHERE singleton = 0")
    fun observe(): Flow<ActiveStateEntity?>

    @Query("SELECT * FROM active_state WHERE singleton = 0")
    suspend fun get(): ActiveStateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(state: ActiveStateEntity)

    @Query("DELETE FROM active_state")
    suspend fun clear()
}
