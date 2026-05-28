package com.focuslog.wear.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.focuslog.wear.BuildConfig
import com.focuslog.wear.data.SupabaseProvider
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken

/**
 * Handles one-time Google sign-in on the watch and restoration of an existing session.
 *
 * Flow:
 *  1. [restore] — if a refresh token is stored, hand it to supabase-kt and refresh → no UI.
 *  2. [signInWithGoogle] — Credential Manager returns a Google ID token minted for the Supabase
 *     Google provider's Web client ID; we exchange it via Supabase `signInWith(IDToken)`.
 *  3. After either path, we persist the resulting session tokens via [SessionStore].
 */
class AuthManager(context: Context) {

    private val appContext = context.applicationContext
    private val store = SessionStore(appContext)
    private val auth get() = SupabaseProvider.client.auth

    fun hasStoredSession(): Boolean = store.hasSession()

    /** Restore a session from the stored refresh token. Returns true if a valid session exists. */
    suspend fun restore(): Boolean {
        val refresh = store.refreshToken() ?: return false
        return runCatching {
            auth.refreshSession(refresh)
            persistCurrent()
            true
        }.getOrElse {
            store.clear()
            false
        }
    }

    /** Launch the Google credential picker and exchange the ID token for a Supabase session. */
    suspend fun signInWithGoogle(): Result<Unit> = runCatching {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setFilterByAuthorizedAccounts(false)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val response = CredentialManager.create(appContext)
            .getCredential(appContext, request)
        val googleCred = GoogleIdTokenCredential.createFrom(response.credential.data)

        auth.signInWith(IDToken) {
            idToken = googleCred.idToken
            provider = Google
        }
        persistCurrent()
    }

    suspend fun signOut() {
        runCatching { auth.signOut() }
        store.clear()
    }

    /** The signed-in user id, used as `user_id` on inserted blocks. */
    fun currentUserId(): String? = auth.currentSessionOrNull()?.user?.id

    private fun persistCurrent() {
        val session = auth.currentSessionOrNull() ?: return
        store.save(session.accessToken, session.refreshToken)
    }
}
