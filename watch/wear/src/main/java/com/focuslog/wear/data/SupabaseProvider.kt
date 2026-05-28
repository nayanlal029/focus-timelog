package com.focuslog.wear.data

import com.focuslog.wear.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

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
