package com.focuslog.wear.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.watchDataStore: DataStore<Preferences> by preferencesDataStore(name = "watch_settings")

class WatchSettings(private val context: Context) {

    companion object {
        val POMODORO_WORK_MIN  = intPreferencesKey("pomodoro_work_min")
        val POMODORO_BREAK_MIN = intPreferencesKey("pomodoro_break_min")
        val SLEEP_AFTER_SEC    = intPreferencesKey("sleep_after_sec")
        val LAST_CATEGORY_ID   = stringPreferencesKey("last_category_id")
    }

    val pomodoroWorkMin: Flow<Int>   = context.watchDataStore.data.map { it[POMODORO_WORK_MIN]  ?: 25 }
    val pomodoroBreakMin: Flow<Int>  = context.watchDataStore.data.map { it[POMODORO_BREAK_MIN] ?: 5 }
    val sleepAfterSec: Flow<Int>     = context.watchDataStore.data.map { it[SLEEP_AFTER_SEC]    ?: 8 }
    val lastCategoryId: Flow<String?> = context.watchDataStore.data.map { it[LAST_CATEGORY_ID] }

    suspend fun setPomodoroWorkMin(v: Int)    = context.watchDataStore.edit { it[POMODORO_WORK_MIN]  = v.coerceIn(1, 120) }
    suspend fun setPomodoroBreakMin(v: Int)   = context.watchDataStore.edit { it[POMODORO_BREAK_MIN] = v.coerceIn(1, 60) }
    suspend fun setSleepAfterSec(v: Int)      = context.watchDataStore.edit { it[SLEEP_AFTER_SEC]    = v.coerceIn(3, 60) }
    suspend fun setLastCategoryId(id: String) = context.watchDataStore.edit { it[LAST_CATEGORY_ID]   = id }
}
