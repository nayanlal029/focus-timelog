package com.focuslog.core.data

import com.focuslog.core.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.serializer.KotlinXSerializer
import kotlinx.serialization.json.Json

/**
 * Single Supabase client for the whole app, configured with the same public URL + anon key the
 * web app uses. RLS (`auth.uid() = user_id`) is enforced server-side once a user session exists.
 */
object SupabaseProvider {
    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            // Tolerate extra columns: a `select(*)` on user_profiles returns user_id/created_at/
            // updated_at that our data classes don't declare. Without this, decoding throws and
            // User-ID (handle) login silently fails — even though email login works (it never
            // hits Postgrest). Strictly more permissive, so existing decodes are unaffected.
            defaultSerializer = KotlinXSerializer(Json {
                ignoreUnknownKeys = true
                coerceInputValues = true
            })
            install(Auth) {
                // Tokens are persisted by our own encrypted SessionStore + restored on launch,
                // and supabase-kt refreshes the access token automatically.
                alwaysAutoRefresh = true
                autoLoadFromStorage = false
            }
            install(Postgrest)
        }
    }
}
