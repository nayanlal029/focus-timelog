package com.focuslog.wear.viewmodel

import android.app.Activity
import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.focuslog.core.auth.AuthManager
import com.focuslog.core.data.SyncWorker
import com.focuslog.core.sync.WearAuthContract
import com.focuslog.wear.service.AuthBus
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

enum class AuthState { LOADING, SIGNED_OUT, SIGNED_IN }

class AuthViewModel(app: Application) : AndroidViewModel(app) {

    private val auth = AuthManager(app)

    private val _state = MutableStateFlow(AuthState.LOADING)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        // A session pushed by the phone while this screen is open flips us to SIGNED_IN live.
        viewModelScope.launch {
            AuthBus.signedIn.collect { onSignedIn() }
        }
        viewModelScope.launch {
            when {
                auth.restore() -> onSignedIn()
                importFromPhone() -> onSignedIn()
                else -> _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    /** Mark the session active and kick the sync workers so any blocks queued on the watch
     * (including ones stranded by earlier runs) drain now and stay drained going forward. */
    private fun onSignedIn() {
        _state.value = AuthState.SIGNED_IN
        SyncWorker.enqueue(getApplication())
        SyncWorker.enqueuePeriodic(getApplication())
    }

    /**
     * Zero-touch sign-in: if the phone app already pushed credentials over the Wearable Data
     * Layer (see [WearAuthContract]), import them. Covers the case where the watch app is
     * installed *after* the phone signed in — the listener service only sees future changes,
     * so we also proactively read the existing DataItem on startup.
     */
    private suspend fun importFromPhone(): Boolean = runCatching {
        val client = Wearable.getDataClient(getApplication<Application>())
        val buffer = client.dataItems.await()
        try {
            for (item in buffer) {
                if (item.uri.path != WearAuthContract.PATH_AUTH) continue
                val map = DataMapItem.fromDataItem(item).dataMap
                val access = map.getString(WearAuthContract.KEY_ACCESS_TOKEN) ?: continue
                val refresh = map.getString(WearAuthContract.KEY_REFRESH_TOKEN) ?: continue
                if (auth.importTokens(access, refresh)) {
                    Log.i(TAG, "Signed in from phone credential handoff")
                    return true
                }
            }
        } finally {
            buffer.release()
        }
        false
    }.getOrElse { false }

    /** Must be called from a Composable that has access to an Activity via LocalContext. */
    fun signIn(activity: Activity) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithGoogle(activity)
            if (result.isSuccess) {
                onSignedIn()
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    /** Dev/testing path: email + password sign-in (works on the emulator, no Google needed). */
    fun signInWithEmail(email: String, password: String) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithEmail(email, password)
            if (result.isSuccess) {
                onSignedIn()
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    /** Production path on watch: sign in with short handle + password. */
    fun signInWithHandle(handle: String, password: String) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithHandle(handle, password)
            if (result.isSuccess) {
                onSignedIn()
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    fun clearError() { _error.value = null }

    private companion object { const val TAG = "AuthViewModel" }
}
