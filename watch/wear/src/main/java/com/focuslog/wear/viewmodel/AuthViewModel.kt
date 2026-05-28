package com.focuslog.wear.viewmodel

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

    init {
        viewModelScope.launch {
            _state.value = if (auth.restore()) AuthState.SIGNED_IN else AuthState.SIGNED_OUT
        }
    }

    fun signIn() {
        _state.value = AuthState.LOADING
        viewModelScope.launch {
            val ok = auth.signInWithGoogle().isSuccess
            _state.value = if (ok) AuthState.SIGNED_IN else AuthState.SIGNED_OUT
        }
    }
}
