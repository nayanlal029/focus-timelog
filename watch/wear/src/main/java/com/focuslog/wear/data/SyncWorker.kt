package com.focuslog.wear.data

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Flushes the offline queue when connectivity is available. Enqueued after a failed insert (so a
 * block logged in airplane mode reaches Supabase as soon as the watch reconnects) and on a periodic
 * schedule (so a stuck queue drains itself even if the app is never reopened).
 */
class SyncWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val repo = SupabaseRepository(applicationContext)
        val result = repo.flushPending()
        val remaining = repo.pendingCount()
        return when {
            result.isFailure -> {
                Log.w(TAG, "Sync failed, $remaining queued — will retry", result.exceptionOrNull())
                Result.retry()
            }
            remaining > 0 -> {
                Log.i(TAG, "Sync sent some, $remaining still queued — will retry")
                Result.retry()
            }
            else -> {
                Log.i(TAG, "Sync complete — queue empty")
                Result.success()
            }
        }
    }

    companion object {
        private const val TAG = "FocusLogSync"
        private const val NAME = "focuslog_sync"
        private const val PERIODIC_NAME = "focuslog_sync_periodic"

        private fun networkConstraints() = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        /** One-shot flush as soon as the network is available (after a save / on sign-in). */
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(networkConstraints())
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(NAME, ExistingWorkPolicy.KEEP, request)
        }

        /**
         * Safety net: a recurring flush so a backlog drains on its own even if no new block is ever
         * logged and the app is never reopened. KEEP means we never stack duplicates.
         */
        fun enqueuePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(networkConstraints())
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
