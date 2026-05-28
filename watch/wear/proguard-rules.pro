# Keep kotlinx.serialization metadata for DTOs serialized to/from Supabase.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.focuslog.wear.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.focuslog.wear.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
