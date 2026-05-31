package com.focuslog.wear.viewmodel

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.focuslog.wear.auth.AuthManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AuthState { LOADING, SIGNED_OUT, SIGNED_IN }

class AuthViewModel(app: Application) : AndroidViewModel(app) {

    private val auth = AuthManager(app)

    private val _state = MutableStateFlow(AuthState.LOADING)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        viewModelScope.launch {
            _state.value = if (auth.restore()) AuthState.SIGNED_IN else AuthState.SIGNED_OUT
        }
    }

    /** Must be called from a Composable that has access to an Activity via LocalContext. */
    fun signIn(activity: Activity) {
        _state.value = AuthState.LOADING
        _error.value = null
        viewModelScope.launch {
            val result = auth.signInWithGoogle(activity)
            if (result.isSuccess) {
                _state.value = AuthState.SIGNED_IN
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
                _state.value = AuthState.SIGNED_IN
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
                _state.value = AuthState.SIGNED_IN
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Sign-in failed"
                _state.value = AuthState.SIGNED_OUT
            }
        }
    }

    fun clearError() { _error.value = null }
}
