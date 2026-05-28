package com.focuslog.wear.presentation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text
import com.focuslog.wear.data.CategoryType
import com.focuslog.wear.util.fmtDuration
import com.focuslog.wear.viewmodel.SummaryPeriod
import com.focuslog.wear.viewmodel.SummaryUiState
import com.focuslog.wear.viewmodel.SummaryViewModel

@Composable
fun SummaryScreen(vm: SummaryViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val period by vm.period.collectAsStateWithLifecycle()

    ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
        item {
            ListHeader { Text("Focus Summary") }
        }

        // Period toggle chips
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Last 24 h") },
                colors = if (period == SummaryPeriod.DAY)
                    ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                onClick = { vm.setPeriod(SummaryPeriod.DAY) },
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Last 7 days") },
                colors = if (period == SummaryPeriod.WEEK)
                    ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                onClick = { vm.setPeriod(SummaryPeriod.WEEK) },
            )
        }

        when (val s = state) {
            is SummaryUiState.Loading -> item { CircularProgressIndicator() }

            is SummaryUiState.Error -> item {
                Text(
                    text = "Error: ${s.message}",
                    color = FocusColors.Distraction,
                    fontSize = 12.sp,
                )
            }

            is SummaryUiState.Ready -> {
                item {
                    Text(
                        text = "Total focus: ${fmtDuration(s.totalFocusMs)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = FocusColors.Focus,
                    )
                }
                if (s.items.isEmpty()) {
                    item { Text("No data for this period", fontSize = 12.sp) }
                } else {
                    items(s.items, key = { it.name }) { item ->
                        Chip(
                            modifier = Modifier.fillMaxWidth(),
                            label = {
                                Text(
                                    "${item.name}  ${fmtDuration(item.totalMs)}",
                                    fontSize = 12.sp,
                                )
                            },
                            colors = ChipDefaults.chipColors(
                                backgroundColor = Color.Transparent,
                                contentColor = FocusColors.forType(item.type),
                            ),
                            onClick = {},
                        )
                    }
                }

                item {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("↺ Refresh") },
                        colors = ChipDefaults.secondaryChipColors(),
                        onClick = { vm.refresh() },
                    )
                }
            }
        }
    }
}
