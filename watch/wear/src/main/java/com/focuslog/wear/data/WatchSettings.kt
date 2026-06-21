package com.focuslog.wear.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.watchDataStore: DataStore<Preferences> by preferencesDataStore(name = "watch_settings")

class WatchSettings(private val context: Context) {

    companion object {
        val POMODORO_WORK_MIN          = intPreferencesKey("pomodoro_work_min")
        val POMODORO_BREAK_MIN         = intPreferencesKey("pomodoro_break_min")
        val POMODORO_ENABLED           = booleanPreferencesKey("pomodoro_enabled")
        val SLEEP_AFTER_SEC            = intPreferencesKey("sleep_after_sec")
        val LAST_CATEGORY_ID           = stringPreferencesKey("last_category_id")
        val DEFAULT_CATEGORIES_SEEDED  = booleanPreferencesKey("default_categories_seeded")
        val RECENT_CATEGORY_IDS        = stringPreferencesKey("recent_category_ids")
        val CHECKIN_ENABLED            = booleanPreferencesKey("checkin_enabled")
        val CHECKIN_FOCUS_MIN          = intPreferencesKey("checkin_focus_min")
        val CHECKIN_BREAK_MIN          = intPreferencesKey("checkin_break_min")
        val CHECKIN_BUZZ_COUNT         = intPreferencesKey("checkin_buzz_count")       // 1..10
        val CHECKIN_BUZZ_INTENSITY     = intPreferencesKey("checkin_buzz_intensity")   // 0=Light,1=Med,2=Strong
        // Shared check-in bookkeeping: written by both the ViewModel and the foreground service so
        // reminders keep firing on schedule even while the app UI (and its ViewModel) is gone.
        val CHECKIN_LAST_AT            = longPreferencesKey("checkin_last_at")
        val CHECKIN_SNOOZED_UNTIL      = longPreferencesKey("checkin_snoozed_until")
        // Wall-clock time of the last successful block upload, surfaced on the Sync page.
        val LAST_SYNCED_AT             = longPreferencesKey("last_synced_at")
    }

    val pomodoroWorkMin: Flow<Int>    = context.watchDataStore.data.map { it[POMODORO_WORK_MIN]  ?: 25 }
    val pomodoroBreakMin: Flow<Int>   = context.watchDataStore.data.map { it[POMODORO_BREAK_MIN] ?: 5 }
    val pomodoroEnabled: Flow<Boolean> = context.watchDataStore.data.map { it[POMODORO_ENABLED] ?: true }
    val sleepAfterSec: Flow<Int>      = context.watchDataStore.data.map { it[SLEEP_AFTER_SEC]    ?: 8 }
    val lastCategoryId: Flow<String?> = context.watchDataStore.data.map { it[LAST_CATEGORY_ID] }
    val checkInEnabled: Flow<Boolean> = context.watchDataStore.data.map { it[CHECKIN_ENABLED] ?: true }
    val checkInFocusMin: Flow<Int>    = context.watchDataStore.data.map { it[CHECKIN_FOCUS_MIN] ?: 5 }
    val checkInBreakMin: Flow<Int>    = context.watchDataStore.data.map { it[CHECKIN_BREAK_MIN] ?: 2 }
    val checkInBuzzCount: Flow<Int>   = context.watchDataStore.data.map { it[CHECKIN_BUZZ_COUNT] ?: 3 }
    val checkInBuzzIntensity: Flow<Int> = context.watchDataStore.data.map { it[CHECKIN_BUZZ_INTENSITY] ?: 2 }
    val checkInLastAt: Flow<Long>     = context.watchDataStore.data.map { it[CHECKIN_LAST_AT] ?: 0L }
    val checkInSnoozedUntil: Flow<Long> = context.watchDataStore.data.map { it[CHECKIN_SNOOZED_UNTIL] ?: 0L }
    val lastSyncedAt: Flow<Long>      = context.watchDataStore.data.map { it[LAST_SYNCED_AT] ?: 0L }

    val defaultCategoriesSeeded: Flow<Boolean> =
        context.watchDataStore.data.map { it[DEFAULT_CATEGORIES_SEEDED] ?: false }

    val recentCategoryIds: Flow<List<String>> =
        context.watchDataStore.data.map { prefs ->
            prefs[RECENT_CATEGORY_IDS]
                ?.split(",")
                ?.filter { it.isNotBlank() }
                ?: emptyList()
        }

    suspend fun setPomodoroWorkMin(v: Int)    = context.watchDataStore.edit { it[POMODORO_WORK_MIN]  = v.coerceIn(1, 120) }
    suspend fun setPomodoroBreakMin(v: Int)   = context.watchDataStore.edit { it[POMODORO_BREAK_MIN] = v.coerceIn(1, 60) }
    suspend fun setPomodoroEnabled(v: Boolean) = context.watchDataStore.edit { it[POMODORO_ENABLED] = v }
    suspend fun setSleepAfterSec(v: Int)      = context.watchDataStore.edit { it[SLEEP_AFTER_SEC]    = v.coerceIn(3, 60) }
    suspend fun setLastCategoryId(id: String) = context.watchDataStore.edit { it[LAST_CATEGORY_ID]   = id }
    suspend fun setCheckInEnabled(v: Boolean) = context.watchDataStore.edit { it[CHECKIN_ENABLED] = v }
    suspend fun setCheckInFocusMin(v: Int)    = context.watchDataStore.edit { it[CHECKIN_FOCUS_MIN] = v.coerceIn(1, 30) }
    suspend fun setCheckInBreakMin(v: Int)    = context.watchDataStore.edit { it[CHECKIN_BREAK_MIN] = v.coerceIn(1, 15) }
    suspend fun setCheckInBuzzCount(v: Int)   = context.watchDataStore.edit { it[CHECKIN_BUZZ_COUNT] = v.coerceIn(1, 10) }
    suspend fun setCheckInBuzzIntensity(v: Int) = context.watchDataStore.edit { it[CHECKIN_BUZZ_INTENSITY] = v.coerceIn(0, 2) }
    suspend fun setCheckInLastAt(v: Long)     = context.watchDataStore.edit { it[CHECKIN_LAST_AT] = v }
    suspend fun setCheckInSnoozedUntil(v: Long) = context.watchDataStore.edit { it[CHECKIN_SNOOZED_UNTIL] = v }
    suspend fun setLastSyncedAt(v: Long)      = context.watchDataStore.edit { it[LAST_SYNCED_AT] = v }

    suspend fun markDefaultCategoriesSeeded() =
        context.watchDataStore.edit { it[DEFAULT_CATEGORIES_SEEDED] = true }

    suspend fun pushRecentCategory(id: String) {
        context.watchDataStore.edit { prefs ->
            val current = prefs[RECENT_CATEGORY_IDS]
                ?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
            val updated = (listOf(id) + current.filter { it != id }).take(10)
            prefs[RECENT_CATEGORY_IDS] = updated.joinToString(",")
        }
    }
}
