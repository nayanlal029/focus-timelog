package com.focuslog.wear.auth

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.focuslog.wear.BuildConfig
import com.focuslog.wear.data.SupabaseProvider
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.user.UserSession
import java.security.MessageDigest
import java.util.UUID

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
            // Force a real refresh so a token from a different/old Supabase project (or an
            // expired one) is rejected here rather than silently landing on the home screen
            // with a session that can't read any data. Throws if the refresh token is invalid.
            auth.refreshCurrentSession()
            val valid = auth.currentSessionOrNull()?.user?.id != null
            if (!valid) throw IllegalStateException("No valid session after refresh")
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
    suspend fun signInWithGoogle(activity: Activity): Result<Unit> = runCatching<Unit> {
        val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
        // Fail loudly if secrets.properties wasn't picked up (it must live at watch/secrets.properties,
        // the Gradle root) — otherwise the build silently uses placeholder values and sign-in can
        // never work.
        require(clientId.isNotBlank() && !clientId.startsWith("YOUR-")) {
            "GOOGLE_WEB_CLIENT_ID not configured. Put real values in watch/secrets.properties."
        }

        // Nonce binds the Google token to this request. Google receives the SHA-256 hash; Supabase
        // verifies the token against the raw value we pass to signInWith. Required when the Supabase
        // Google provider has nonce checks on; harmless when off.
        val rawNonce = UUID.randomUUID().toString()
        val hashedNonce = sha256Hex(rawNonce)

        // GetSignInWithGoogleOption drives the explicit "Sign in with Google" button flow: it
        // always surfaces the account chooser (and add-account) even when no Google credential is
        // present yet. GetGoogleIdOption, by contrast, silently throws NoCredentialException when
        // there are no authorized accounts — which is why the picker never appeared.
        val googleOption = GetSignInWithGoogleOption.Builder(clientId)
            .setNonce(hashedNonce)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build()

        val response = CredentialManager.create(activity)
            .getCredential(activity, request)
        val googleCred = GoogleIdTokenCredential.createFrom(response.credential.data)

        auth.signInWith(IDToken) {
            idToken = googleCred.idToken
            provider = Google
            nonce = rawNonce
        }
        persistCurrent()
        val uid = auth.currentSessionOrNull()?.user?.id
            ?: throw IllegalStateException(
                "Google token accepted by the device but Supabase created no session. " +
                    "Add this Web client ID to the Supabase Google provider's authorized client IDs."
            )
        Log.i(TAG, "Google sign-in OK (user=$uid)")
    }.recoverCatching { e ->
        // Surface the concrete cause to the sign-in screen and logcat instead of a generic failure.
        Log.e(TAG, "Google sign-in failed: ${e::class.simpleName}: ${e.message}", e)
        throw Exception("${e::class.simpleName}: ${e.message ?: "unknown error"}", e)
    }

    private fun sha256Hex(input: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray())
            .joinToString("") { "%02x".format(it) }

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

    /**
     * Best-effort user id for queuing blocks: the live session id, or the last id we persisted.
     * Prevents silently dropping a logged block when the session momentarily can't be read.
     */
    fun lastKnownUserId(): String? = currentUserId() ?: prefs.getString(KEY_USER_ID, null)

    /** Email of the signed-in account, for on-device diagnostics ("which account am I synced as?"). */
    fun currentEmail(): String? =
        auth.currentSessionOrNull()?.user?.email ?: prefs.getString(KEY_EMAIL, null)

    private fun persistCurrent() {
        val s = auth.currentSessionOrNull() ?: return
        prefs.edit()
            .putString(KEY_ACCESS, s.accessToken)
            .putString(KEY_REFRESH, s.refreshToken)
            .apply()
        s.user?.let { u ->
            prefs.edit()
                .putString(KEY_USER_ID, u.id)
                .putString(KEY_EMAIL, u.email)
                .apply()
        }
    }

    private companion object {
        const val TAG = "AuthManager"
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_USER_ID = "user_id"
        const val KEY_EMAIL = "email"
    }
}
