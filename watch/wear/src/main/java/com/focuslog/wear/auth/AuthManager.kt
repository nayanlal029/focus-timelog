package com.focuslog.wear.auth

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.focuslog.wear.BuildConfig
import com.focuslog.wear.data.SupabaseProvider
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.user.UserSession

/**
 * Handles one-time Google sign-in and session restoration.
 *
 * Session tokens are kept in plain SharedPreferences for simplicity (upgrade to
 * EncryptedSharedPreferences before shipping to others).
 *
 * Flow on cold start:
 *  1. [restore] — loads stored refresh token → importSession → auto-refresh if expired.
 *  2. If no token: [signInWithGoogle] requires a live Activity for Credential Manager.
 */
class AuthManager(context: Context) {

    private val appContext = context.applicationContext
    private val auth get() = SupabaseProvider.client.auth

    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("focuslog_session", Context.MODE_PRIVATE)

    fun hasStoredSession(): Boolean = prefs.getString(KEY_REFRESH, null) != null

    /**
     * Restore a session from the stored refresh token.
     * NOTE: UserSession import path may vary by supabase-kt version.
     * If this fails to compile try: io.github.jan.supabase.auth.UserSession
     */
    suspend fun restore(): Boolean {
        val access = prefs.getString(KEY_ACCESS, "") ?: ""
        val refresh = prefs.getString(KEY_REFRESH, null) ?: return false
        return runCatching {
            auth.importSession(
                UserSession(
                    accessToken = access,
                    refreshToken = refresh,
                    expiresIn = 0L,   // 0 forces immediate refresh via the refresh token
                    tokenType = "bearer",
                    user = null,
                )
            )
            persistCurrent()
            true
        }.getOrElse {
            prefs.edit().clear().apply()
            false
        }
    }

    /**
     * Launch the Google credential picker. MUST be called from a live Activity context.
     * On Wear OS the user taps "Sign in with Google" → watch shows the account picker → done.
     */
    suspend fun signInWithGoogle(activity: Activity): Result<Unit> = runCatching {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setFilterByAuthorizedAccounts(false)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val response = CredentialManager.create(activity)
            .getCredential(activity, request)
        val googleCred = GoogleIdTokenCredential.createFrom(response.credential.data)

        auth.signInWith(IDToken) {
            idToken = googleCred.idToken
            provider = Google
        }
        persistCurrent()
    }

    /**
     * Dev/testing sign-in with email + password against the same Supabase project.
     * Lets us verify the sync round-trip on the Wear OS emulator, which can't do Google
     * sign-in (no way to add a Google account without a paired phone). Google remains the
     * production path on a real watch.
     */
    suspend fun signInWithEmail(email: String, password: String): Result<Unit> = runCatching {
        auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
        persistCurrent()
    }

    suspend fun signOut() {
        runCatching { auth.signOut() }
        prefs.edit().clear().apply()
    }

    fun currentUserId(): String? = auth.currentSessionOrNull()?.user?.id

    private fun persistCurrent() {
        val s = auth.currentSessionOrNull() ?: return
        prefs.edit()
            .putString(KEY_ACCESS, s.accessToken)
            .putString(KEY_REFRESH, s.refreshToken)
            .apply()
    }

    private companion object {
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
    }
}
