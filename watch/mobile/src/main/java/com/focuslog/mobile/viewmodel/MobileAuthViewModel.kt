package com.focuslog.mobile.viewmodel

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.focuslog.core.auth.AuthManager
import com.focuslog.core.data.SyncWorker
import com.focuslog.mobile.sync.WearAuthSync
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AuthState { LOADING, SIGNED_OUT, SIGNED_IN }

enum class WatchPushState { IDLE, SENDING, SENT, FAILED }

class MobileAuthViewModel(app: Application) : AndroidViewModel(app) {

    private val auth = AuthManager(app)

    private val _state = MutableStateFlow(AuthState.LOADING)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _handle = MutableStateFlow<String?>(null)
    val handle: StateFlow<String?> = _handle.asStateFlow()

    private val _watchPush = MutableStateFlow(WatchPushState.IDLE)
    val watchPush: StateFlow<WatchPushState> = _watchPush.asStateFlow()

    fun email(): String? = auth.currentEmail()

    init {
        viewModelScope.launch {
            val restored = auth.restore()
            _state.value = if (restored) AuthState.SIGNED_IN else AuthState.SIGNED_OUT
            if (restored) onSignedIn()
        }
    }

    /** After any successful sign-in: fetch handle, auto-push credentials to the watch, and kick
     * the sync workers so any queued blocks drain now and keep draining in the background. */
    private fun onSignedIn() {
        viewModelScope.launch { _handle.value = auth.fetchHandle() }
        pushToWatch()
        SyncWorker.enqueue(getApplication())
        SyncWorker.enqueuePeriodic(getApplication())
    }

    /** Push the current session to the paired watch (also runs automatically on sign-in). */
    fun pushToWatch() {
        val (access, refresh) = auth.currentTokens() ?: return
        _watchPush.value = WatchPushState.SENDING
        viewModelScope.launch {
            val ok = WearAuthSync.pushCredentials(
                getApplication(), access, refresh, auth.currentEmail(), _handle.value,
            )
            _watchPush.value = if (ok) WatchPushState.SENT else WatchPushState.FAILED
        }
    }

    fun signInWithGoogle(activity: Activity) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithGoogle(activity)
            if (result.isSuccess) {
                _state.value = AuthState.SIGNED_IN
                onSignedIn()
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    fun signInWithEmail(email: String, password: String) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithEmail(email, password)
            if (result.isSuccess) {
                _state.value = AuthState.SIGNED_IN
                onSignedIn()
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    /** Sign in with the short User ID (handle) + password — same flow as the watch. */
    fun signInWithHandle(handle: String, password: String) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithHandle(handle, password)
            if (result.isSuccess) {
                _state.value = AuthState.SIGNED_IN
                onSignedIn()
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            WearAuthSync.clear(getApplication())
            auth.signOut()
            _handle.value = null
            _watchPush.value = WatchPushState.IDLE
            _state.value = AuthState.SIGNED_OUT
        }
    }

    fun clearError() { _error.value = null }
}
