package com.focuslog.wear.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.dialog.Alert
import com.focuslog.wear.util.fmtDuration
import com.focuslog.wear.util.fmtHMS
import com.focuslog.wear.viewmodel.Active
import com.focuslog.wear.viewmodel.TimerPhase
import com.focuslog.wear.viewmodel.WatchAlert
import kotlinx.coroutines.flow.SharedFlow

@Composable
fun ActiveTimerScreen(
    active: Active,
    now: Long,
    pomodoroEnabled: Boolean,
    pomodoroWorkMs: Long,
    alertFlow: SharedFlow<WatchAlert>,
    onPauseResume: () -> Unit,
    onStop: () -> Unit,
) {
    val paused = active.phase == TimerPhase.PAUSED
    val focusMs = active.focusElapsed(now)
    val breakMs = active.breakElapsed(now)

    // Alert dialog state
    var alertMessage by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(alertFlow) {
        alertFlow.collect { alert ->
            alertMessage = when (alert) {
                WatchAlert.DistractionThreshold -> "5 min break!\nBack to work?"
                WatchAlert.PomodoroWorkDone -> "25 min done!\nTake a 5 min break."
                WatchAlert.PomodoroBreakDone -> "Break over!\nTime to focus."
            }
        }
    }

    if (alertMessage != null) {
        Alert(
            title = { Text("⏰ Alert", textAlign = TextAlign.Center) },
            negativeButton = {
                Button(
                    onClick = { alertMessage = null },
                    colors = ButtonDefaults.secondaryButtonColors(),
                ) { Text("OK") }
            },
            positiveButton = {
                Button(
                    onClick = { alertMessage = null; onPauseResume() },
                    colors = ButtonDefaults.primaryButtonColors(),
                ) { Text(if (paused) "Resume" else "Pause") }
            },
        ) {
            Text(
                text = alertMessage ?: "",
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.body2
            )
        }
    } else {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Category name (color coded)
            Text(
                text = active.categoryName,
                color = FocusColors.forType(active.type),
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
            )

            if (pomodoroEnabled && !paused) {
                // Pomodoro: show countdown remaining
                val remaining = (pomodoroWorkMs - focusMs).coerceAtLeast(0)
                Text(
                    text = fmtHMS(remaining),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (remaining < 60_000L) FocusColors.Distraction else FocusColors.Focus,
                )
                Text(
                    text = "🍅 remaining",
                    fontSize = 11.sp,
                    color = FocusColors.Neutral,
                )
            } else {
                // Normal: show elapsed focus time
                Text(
                    text = fmtHMS(focusMs),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                )
                if (pomodoroEnabled) {
                    Text(
                        text = "🍅 ${fmtDuration(pomodoroWorkMs)} session",
                        fontSize = 11.sp,
                        color = FocusColors.Neutral,
                    )
                }
            }

            // Break / distraction timer (shown while paused)
            if (paused) {
                Text(
                    text = "Break  ${fmtHMS(breakMs)}",
                    color = FocusColors.Distraction,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }

            Row(
                modifier = Modifier.padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(
                    onClick = onPauseResume,
                    colors = ButtonDefaults.secondaryButtonColors(),
                ) { Text(if (paused) "Resume" else "Pause") }

                Button(
                    onClick = onStop,
                    colors = ButtonDefaults.primaryButtonColors(),
                ) { Text("Stop") }
            }
        }
    }
}
