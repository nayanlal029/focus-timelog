package com.focuslog.wear.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text
import com.focuslog.wear.data.Category
import com.focuslog.wear.data.CategoryType

@Composable
fun CategoryPickerScreen(
    categories: List<Category>,
    runningName: String?,
    pomodoroEnabled: Boolean,
    onResumeRunning: () -> Unit,
    onPick: (Category) -> Unit,
    onTogglePomodoro: () -> Unit,
    onAddCategory: () -> Unit,
    onSummary: () -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val sorted = categories.sortedWith(
        compareBy({ typeRank(it.type) }, { it.order }, { it.name })
    )

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
    ) {
        item {
            ListHeader { Text("Focus Log") }
        }

        // Toolbar chips: Pomodoro toggle, Summary, Add category
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text(if (pomodoroEnabled) "🍅 Pomodoro ON" else "🍅 Pomodoro OFF") },
                colors = if (pomodoroEnabled)
                    ChipDefaults.primaryChipColors()
                else
                    ChipDefaults.secondaryChipColors(),
                onClick = onTogglePomodoro,
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("📊 Focus Summary") },
                colors = ChipDefaults.secondaryChipColors(),
                onClick = onSummary,
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("＋ Add Category") },
                colors = ChipDefaults.secondaryChipColors(),
                onClick = onAddCategory,
            )
        }

        // Running timer (if any)
        if (runningName != null) {
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("▶ $runningName") },
                    colors = ChipDefaults.primaryChipColors(),
                    onClick = onResumeRunning,
                )
            }
        }

        // Category list
        if (sorted.isEmpty()) {
            item { Text("No categories yet. Tap '+ Add Category' or use the web app.") }
        } else {
            items(sorted, key = { it.id }) { category ->
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(category.name) },
                    icon = { ColorDot(FocusColors.forType(category.type)) },
                    colors = ChipDefaults.secondaryChipColors(),
                    onClick = { onPick(category) },
                )
            }
        }
    }
}

@Composable
private fun ColorDot(color: Color) {
    Box(
        modifier = Modifier
            .size(10.dp)
            .background(color = color, shape = CircleShape)
    )
}

private fun typeRank(type: CategoryType): Int = when (type) {
    CategoryType.FOCUS -> 0
    CategoryType.NEUTRAL -> 1
    CategoryType.DISTRACTION -> 2
}
