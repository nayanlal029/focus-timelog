package com.focuslog.wear.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Text
import com.focuslog.wear.data.CategoryType
import com.focuslog.wear.util.fmtDuration
import com.focuslog.wear.viewmodel.SummaryUiState
import com.focuslog.wear.viewmodel.SummaryViewModel

@Composable
fun DaySummaryScreen(
    vm: SummaryViewModel,
    onViewFull: () -> Unit,
) {
    LaunchedEffect(Unit) { vm.refresh() }

    val state by vm.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Today's Focus",
            fontSize = 11.sp,
            color = FocusColors.Neutral,
            textAlign = TextAlign.Center,
        )

        when (val s = state) {
            is SummaryUiState.Loading -> {
                CircularProgressIndicator(modifier = Modifier.padding(top = 8.dp))
            }

            is SummaryUiState.Error -> {
                Text(
                    text = "Couldn't load stats",
                    fontSize = 12.sp,
                    color = FocusColors.Distraction,
                    modifier = Modifier.padding(top = 6.dp),
                    textAlign = TextAlign.Center,
                )
            }

            is SummaryUiState.Ready -> {
                val focusMs       = s.items.filter { it.type == CategoryType.FOCUS }.sumOf { it.totalMs }
                val neutralMs     = s.items.filter { it.type == CategoryType.NEUTRAL }.sumOf { it.totalMs }
                val distractionMs = s.items.filter { it.type == CategoryType.DISTRACTION }.sumOf { it.totalMs }

                if (focusMs == 0L && neutralMs == 0L && distractionMs == 0L) {
                    Text(
                        text = "Nothing logged yet today",
                        fontSize = 12.sp,
                        color = FocusColors.Neutral,
                        modifier = Modifier.padding(top = 8.dp),
                        textAlign = TextAlign.Center,
                    )
                } else {
                    Text(
                        text = fmtDuration(focusMs),
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold,
                        color = FocusColors.Focus,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    if (neutralMs > 0L) {
                        Text(
                            text = "Neutral  ${fmtDuration(neutralMs)}",
                            fontSize = 12.sp,
                            color = FocusColors.Neutral,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    if (distractionMs > 0L) {
                        Text(
                            text = "Distracted  ${fmtDuration(distractionMs)}",
                            fontSize = 12.sp,
                            color = FocusColors.Distraction,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
        }

        Chip(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp),
            label = { Text("📊 Full Summary") },
            colors = ChipDefaults.secondaryChipColors(),
            onClick = onViewFull,
        )
    }
}
