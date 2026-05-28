package com.focuslog.wear.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [CategoryEntity::class, PendingBlockEntity::class, ActiveStateEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class WatchDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao
    abstract fun pendingBlockDao(): PendingBlockDao
    abstract fun activeStateDao(): ActiveStateDao

    companion object {
        @Volatile private var instance: WatchDatabase? = null

        fun get(context: Context): WatchDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    WatchDatabase::class.java,
                    "focuslog.db",
                ).build().also { instance = it }
            }
    }
}
