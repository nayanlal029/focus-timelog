package com.focuslog.wear.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text
import com.focuslog.wear.data.Category
import com.focuslog.wear.data.CategoryType
import com.focuslog.wear.util.fmtDuration
import com.focuslog.wear.viewmodel.Active
import com.focuslog.wear.viewmodel.SummaryUiState
import com.focuslog.wear.viewmodel.SummaryViewModel

@Composable
fun HomeScreen(
    categories: List<Category>,
    selected: Category?,
    active: Active?,
    pomodoroEnabled: Boolean,
    pomodoroWorkMin: Int,
    pomodoroBreakMin: Int,
    sleepAfterSec: Int,
    recentCategoryIds: List<String>,
    summaryVm: SummaryViewModel,
    onStart: () -> Unit,
    onSelect: (Category) -> Unit,
    onResumeRunning: () -> Unit,
    onAddCategory: () -> Unit,
    onTogglePomodoro: () -> Unit,
    onSummary: () -> Unit,
    onPomodoroWorkChange: (Int) -> Unit,
    onPomodoroBreakChange: (Int) -> Unit,
    onSleepChange: (Int) -> Unit,
) {
    val pagerState = rememberPagerState(pageCount = { 2 })

    HorizontalPager(
        state = pagerState,
        modifier = Modifier.fillMaxSize(),
    ) { page ->
        when (page) {
            0 -> PlayPage(
                categories = categories,
                selected = selected,
                active = active,
                recentIds = recentCategoryIds,
                summaryVm = summaryVm,
                onStart = onStart,
                onSelect = onSelect,
                onResumeRunning = onResumeRunning,
                onAddCategory = onAddCategory,
                onSummary = onSummary,
            )
            else -> SettingsPage(
                pomodoroEnabled = pomodoroEnabled,
                pomodoroWorkMin = pomodoroWorkMin,
                pomodoroBreakMin = pomodoroBreakMin,
                sleepAfterSec = sleepAfterSec,
                onTogglePomodoro = onTogglePomodoro,
                onSummary = onSummary,
                onPomodoroWorkChange = onPomodoroWorkChange,
                onPomodoroBreakChange = onPomodoroBreakChange,
                onSleepChange = onSleepChange,
            )
        }
    }
}

// ── Page 0: Play button + category list ──────────────────────────────────────

@Composable
private fun PlayPage(
    categories: List<Category>,
    selected: Category?,
    active: Active?,
    recentIds: List<String>,
    summaryVm: SummaryViewModel,
    onStart: () -> Unit,
    onSelect: (Category) -> Unit,
    onResumeRunning: () -> Unit,
    onAddCategory: () -> Unit,
    onSummary: () -> Unit,
) {
    LaunchedEffect(Unit) { summaryVm.refresh() }
    val summaryState by summaryVm.state.collectAsStateWithLifecycle()

    val sorted = categories.sortedWith(
        compareBy(
            { val pos = recentIds.indexOf(it.id); if (pos == -1) Int.MAX_VALUE else pos },
            { typeRank(it.type) },
            { it.order },
            { it.name },
        )
    )
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item { ListHeader { Text("Focus Log") } }

        // Today's stats: focus (green/bold) · distracted (red) · neutral (amber)
        item {
            val s = summaryState
            if (s is SummaryUiState.Ready) {
                val focusMs = s.items.filter { it.type == CategoryType.FOCUS }.sumOf { it.totalMs }
                val redMs   = s.items.filter { it.type == CategoryType.DISTRACTION }.sumOf { it.totalMs }
                val neutMs  = s.items.filter { it.type == CategoryType.NEUTRAL }.sumOf { it.totalMs }
                if (focusMs > 0L || redMs > 0L || neutMs > 0L) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp)
                            .clickable { onSummary() },
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (focusMs > 0L) Text(fmtDuration(focusMs), color = FocusColors.Focus,       fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        if (redMs  > 0L) Text("  ${fmtDuration(redMs)}",  color = FocusColors.Distraction, fontSize = 11.sp)
                        if (neutMs > 0L) Text("  ${fmtDuration(neutMs)}", color = FocusColors.Neutral,     fontSize = 11.sp)
                    }
                }
            }
        }

        // Resume running timer (if any)
        if (active != null) {
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("▶ ${active.categoryName}", fontWeight = FontWeight.Medium) },
                    colors = ChipDefaults.primaryChipColors(),
                    onClick = onResumeRunning,
                )
            }
        }

        // Pre-selected category label
        item {
            Text(
                text = selected?.name ?: "No category selected",
                color = if (selected != null) FocusColors.forType(selected.type) else FocusColors.Neutral,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp, bottom = 2.dp),
            )
        }

        // Large play button
        item {
            Button(
                onClick = onStart,
                enabled = selected != null,
                modifier = Modifier.size(70.dp),
                colors = ButtonDefaults.primaryButtonColors(),
            ) {
                Text("▶", fontSize = 26.sp)
            }
        }

        // Category list header
        item {
            Text(
                text = "↓ categories",
                fontSize = 10.sp,
                color = FocusColors.Neutral,
                modifier = Modifier.padding(top = 10.dp, bottom = 2.dp),
            )
        }

        // Add category
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("＋ Add Category") },
                colors = ChipDefaults.secondaryChipColors(),
                onClick = onAddCategory,
            )
        }

        // Category pills — tap to select AND start immediately
        if (sorted.isEmpty()) {
            item {
                Text(
                    text = "No categories yet.\nTap + or use the web app.",
                    textAlign = TextAlign.Center,
                    fontSize = 12.sp,
                    color = FocusColors.Neutral,
                    modifier = Modifier.padding(8.dp),
                )
            }
        } else {
            items(sorted, key = { it.id }) { category ->
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(category.name) },
                    icon = { ColorDot(FocusColors.forType(category.type)) },
                    colors = if (category.id == selected?.id)
                        ChipDefaults.primaryChipColors()
                    else
                        ChipDefaults.secondaryChipColors(),
                    onClick = { onSelect(category) },
                )
            }
        }
    }
}

// ── Page 1: Settings ──────────────────────────────────────────────────────────

@Composable
private fun SettingsPage(
    pomodoroEnabled: Boolean,
    pomodoroWorkMin: Int,
    pomodoroBreakMin: Int,
    sleepAfterSec: Int,
    onTogglePomodoro: () -> Unit,
    onSummary: () -> Unit,
    onPomodoroWorkChange: (Int) -> Unit,
    onPomodoroBreakChange: (Int) -> Unit,
    onSleepChange: (Int) -> Unit,
) {
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item { ListHeader { Text("Settings") } }

        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text(if (pomodoroEnabled) "🍅 Pomodoro ON" else "🍅 Pomodoro OFF") },
                colors = if (pomodoroEnabled) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                onClick = onTogglePomodoro,
            )
        }

        item {
            StepperRow(
                label = "Work",
                value = pomodoroWorkMin,
                unit = "min",
                step = 5,
                min = 5,
                max = 120,
                onChanged = onPomodoroWorkChange,
            )
        }

        item {
            StepperRow(
                label = "Break",
                value = pomodoroBreakMin,
                unit = "min",
                step = 1,
                min = 1,
                max = 30,
                onChanged = onPomodoroBreakChange,
            )
        }

        item {
            StepperRow(
                label = "Sleep",
                value = sleepAfterSec,
                unit = "sec",
                step = 2,
                min = 3,
                max = 60,
                onChanged = onSleepChange,
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
    }
}

@Composable
private fun StepperRow(
    label: String,
    value: Int,
    unit: String,
    step: Int,
    min: Int,
    max: Int,
    onChanged: (Int) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("$label: $value $unit", fontSize = 12.sp, modifier = Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Button(
                onClick = { onChanged((value - step).coerceAtLeast(min)) },
                modifier = Modifier.size(32.dp),
                colors = ButtonDefaults.secondaryButtonColors(),
            ) { Text("−", fontSize = 14.sp) }
            Button(
                onClick = { onChanged((value + step).coerceAtMost(max)) },
                modifier = Modifier.size(32.dp),
                colors = ButtonDefaults.primaryButtonColors(),
            ) { Text("+", fontSize = 14.sp) }
        }
    }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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
