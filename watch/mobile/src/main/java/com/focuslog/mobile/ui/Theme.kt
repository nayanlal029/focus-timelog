package com.focuslog.mobile.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Mirrors the web app's dark palette: near-black background, focus green accent.
val FocusGreen = Color(0xFF22C55E)
val DistractionRed = Color(0xFFEF4444)
val NeutralGray = Color(0xFF9CA3AF)
val BackgroundDark = Color(0xFF0B1220)
val SurfaceDark = Color(0xFF111A2C)

fun colorForType(type: com.focuslog.core.data.CategoryType): Color = when (type) {
    com.focuslog.core.data.CategoryType.FOCUS -> FocusGreen
    com.focuslog.core.data.CategoryType.DISTRACTION -> DistractionRed
    com.focuslog.core.data.CategoryType.NEUTRAL -> NeutralGray
}

private val DarkColors = darkColorScheme(
    primary = FocusGreen,
    onPrimary = Color(0xFF06220F),
    secondary = NeutralGray,
    error = DistractionRed,
    background = BackgroundDark,
    onBackground = Color(0xFFE5E7EB),
    surface = SurfaceDark,
    onSurface = Color(0xFFE5E7EB),
    surfaceVariant = Color(0xFF1B2740),
    onSurfaceVariant = Color(0xFFB4BCC8),
)

@Composable
fun FocusLogTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
