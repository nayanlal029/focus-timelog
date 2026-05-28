package com.focuslog.wear.presentation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text
import com.focuslog.wear.data.Category
import com.focuslog.wear.data.CategoryType

/**
 * Home screen: pick a category to start logging. Categories are sorted focus-first then by their
 * `order`, matching the web app's chip row. A running timer (if any) is surfaced at the top.
 */
@Composable
fun CategoryPickerScreen(
    categories: List<Category>,
    runningName: String?,
    onResumeRunning: () -> Unit,
    onPick: (Category) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val sorted = categories.sortedWith(
        compareBy({ typeRank(it.type) }, { it.order }, { it.name })
    )

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
    ) {
        item { ListHeader { Text("Focus") } }

        if (runningName != null) {
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Running: $runningName") },
                    colors = ChipDefaults.primaryChipColors(),
                    onClick = onResumeRunning,
                )
            }
        }

        if (sorted.isEmpty()) {
            item { Text("No categories yet. Add them in the web app.") }
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
    Box(modifier = Modifier.size(12.dp).clip(CircleShape).then(Modifier)) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(12.dp),
        )
    }
}

private fun typeRank(type: CategoryType): Int = when (type) {
    CategoryType.FOCUS -> 0
    CategoryType.NEUTRAL -> 1
    CategoryType.DISTRACTION -> 2
}
