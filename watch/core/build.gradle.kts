import java.util.Properties

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// Load public client config from secrets.properties (falls back to defaults for CI).
val secrets = Properties().apply {
    val f = rootProject.file("secrets.properties").takeIf { it.exists() }
        ?: rootProject.file("secrets.defaults.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun secret(key: String): String = (secrets.getProperty(key) ?: "").let { "\"$it\"" }

android {
    namespace = "com.focuslog.core"
    compileSdk = 35

    defaultConfig {
        minSdk = 26   // lowest of the two consumers (:mobile 26, :wear 30)

        buildConfigField("String", "SUPABASE_URL", secret("SUPABASE_URL"))
        buildConfigField("String", "SUPABASE_ANON_KEY", secret("SUPABASE_ANON_KEY"))
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", secret("GOOGLE_WEB_CLIENT_ID"))
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    // `api` so :wear and :mobile see Supabase/Room/Work types used in core signatures.
    val supabaseBom = platform("io.github.jan-tennert.supabase:bom:3.0.0")
    api(supabaseBom)
    api("io.github.jan-tennert.supabase:postgrest-kt")
    api("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.ktor:ktor-client-okhttp:3.0.0")
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Google one-time sign-in via Credential Manager (used by AuthManager on phone + watch)
    api("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Local cache + offline queue + retry
    api("androidx.room:room-runtime:2.6.1")
    api("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    api("androidx.work:work-runtime-ktx:2.9.1")

    // Encrypted token storage
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // User preferences (Pomodoro duration, check-in config, last category)
    api("androidx.datastore:datastore-preferences:1.1.1")

    // Wearable Data Layer (phone ⇄ watch credential handoff contract lives in core)
    api("com.google.android.gms:play-services-wearable:18.2.0")
    api("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")

    api("androidx.core:core-ktx:1.13.1")
}
