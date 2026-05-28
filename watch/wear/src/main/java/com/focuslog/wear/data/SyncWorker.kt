package com.focuslog.wear.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Flushes the offline queue when connectivity is available. Enqueued after a failed insert so a
 * block logged in airplane mode reaches Supabase as soon as the watch reconnects.
 */
class SyncWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val repo = SupabaseRepository(applicationContext)
        val result = repo.flushPending()
        val remaining = repo.pendingCount()
        return when {
            result.isFailure -> Result.retry()
            remaining > 0 -> Result.retry()
            else -> Result.success()
        }
    }

    companion object {
        private const val NAME = "focuslog_sync"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
