package com.focuslog.wear.presentation

import androidx.compose.ui.graphics.Color
import com.focuslog.wear.data.CategoryType

/** Color coding mirrors the web app: focus = blue, distraction = red, neutral = gray. */
object FocusColors {
    val Focus = Color(0xFF3B82F6)
    val Distraction = Color(0xFFEF4444)
    val Neutral = Color(0xFFF59E0B)  // amber

    fun forType(type: CategoryType): Color = when (type) {
        CategoryType.FOCUS -> Focus
        CategoryType.DISTRACTION -> Distraction
        CategoryType.NEUTRAL -> Neutral
    }
}
