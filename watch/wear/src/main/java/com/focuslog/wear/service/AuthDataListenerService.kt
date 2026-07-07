package com.focuslog.wear.service

import android.util.Log
import com.focuslog.core.auth.AuthManager
import com.focuslog.core.sync.WearAuthContract
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.runBlocking

/**
 * Process-wide signal that a session arrived from the phone, so an already-open sign-in screen
 * can flip to SIGNED_IN without a restart.
 */
object AuthBus {
    val signedIn = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
}

/**
 * Receives the phone's credential handoff (see [WearAuthContract]): when the phone app signs in,
 * it writes the Supabase session tokens as a DataItem; this service imports them so the watch is
 * signed in automatically — no typing on the watch, ever.
 *
 * Runs even when the watch app is closed (the system starts it on Data Layer delivery).
 */
class AuthDataListenerService : WearableListenerService() {

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            if (item.uri.path != WearAuthContract.PATH_AUTH) continue

            val map = DataMapItem.fromDataItem(item).dataMap
            val access = map.getString(WearAuthContract.KEY_ACCESS_TOKEN) ?: continue
            val refresh = map.getString(WearAuthContract.KEY_REFRESH_TOKEN) ?: continue

            // WearableListenerService callbacks run on a background thread and the service is
            // stopped once this method returns, so the import must complete synchronously.
            val ok = runBlocking {
                AuthManager(applicationContext).importTokens(access, refresh)
            }
            Log.i(TAG, "Phone credential handoff: import ${if (ok) "OK" else "FAILED"}")
            if (ok) AuthBus.signedIn.tryEmit(Unit)
        }
    }

    private companion object { const val TAG = "AuthDataListener" }
}
