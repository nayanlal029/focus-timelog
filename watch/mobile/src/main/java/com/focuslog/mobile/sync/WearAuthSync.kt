package com.focuslog.mobile.sync

import android.content.Context
import android.util.Log
import com.focuslog.core.sync.WearAuthContract
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await

/**
 * Phone side of the credential handoff: pushes the Supabase session to any paired watch over the
 * Wearable Data Layer. The watch's AuthDataListenerService imports it, so the watch signs in with
 * zero typing. Data Layer delivery is store-and-forward — the watch receives it even if it is
 * offline right now.
 */
object WearAuthSync {

    suspend fun pushCredentials(
        context: Context,
        accessToken: String,
        refreshToken: String,
        email: String?,
        handle: String?,
    ): Boolean = runCatching {
        val request = PutDataMapRequest.create(WearAuthContract.PATH_AUTH).apply {
            dataMap.putString(WearAuthContract.KEY_ACCESS_TOKEN, accessToken)
            dataMap.putString(WearAuthContract.KEY_REFRESH_TOKEN, refreshToken)
            email?.let { dataMap.putString(WearAuthContract.KEY_EMAIL, it) }
            handle?.let { dataMap.putString(WearAuthContract.KEY_HANDLE, it) }
            // Unique per push so re-sending unchanged tokens still triggers onDataChanged.
            dataMap.putLong(WearAuthContract.KEY_UPDATED_AT, System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()

        Wearable.getDataClient(context).putDataItem(request).await()
        Log.i(TAG, "Pushed credentials to watch")
        true
    }.getOrElse {
        Log.e(TAG, "Credential push failed: ${it.message}", it)
        false
    }

    /** Sign-out: remove the credential item so a watch that syncs later doesn't sign back in. */
    suspend fun clear(context: Context): Boolean = runCatching {
        val uri = PutDataMapRequest.create(WearAuthContract.PATH_AUTH).uri
        Wearable.getDataClient(context).deleteDataItems(uri).await()
        true
    }.getOrElse { false }

    private const val TAG = "WearAuthSync"
}
