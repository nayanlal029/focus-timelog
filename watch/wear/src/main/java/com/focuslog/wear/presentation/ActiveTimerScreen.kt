package com.focuslog.wear.presentation

import android.app.Activity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
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
    pomodoroBreakMs: Long,
    sleepAfterSec: Int,
    isAmbient: Boolean,
    alertFlow: SharedFlow<WatchAlert>,
    onPauseResume: () -> Unit,
    onStop: () -> Unit,
) {
    val paused = active.phase == TimerPhase.PAUSED
    val focusMs = active.focusElapsed(now)
    val breakMs = active.breakElapsed(now)

    // Keep screen on for sleepAfterSec, then allow natural sleep
    val window = (LocalContext.current as? Activity)?.window
    LaunchedEffect(sleepAfterSec) {
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        kotlinx.coroutines.delay(sleepAfterSec * 1000L)
        window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
    DisposableEffect(Unit) {
        onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }

    // Alert dialog state
    var alertMessage by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(alertFlow) {
        alertFlow.collect { alert ->
            alertMessage = when (alert) {
                WatchAlert.DistractionThreshold -> "5 min break!\nBack to work?"
                WatchAlert.PomodoroWorkDone -> "${fmtDuration(pomodoroWorkMs)} done!\nTake a break."
                WatchAlert.PomodoroBreakDone -> "Break over!\nTime to focus."
            }
        }
    }

    if (isAmbient) {
        // Minimal ambient display: black bg, white time only
        val remaining = (pomodoroWorkMs - focusMs).coerceAtLeast(0)
        val displayMs = if (pomodoroEnabled && !paused) remaining else focusMs
        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = fmtHMS(displayMs),
                color = Color.White,
                fontFamily = FontFamily.Monospace,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        return
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
            Text(
                text = active.categoryName,
                color = FocusColors.forType(active.type),
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
            )

            if (pomodoroEnabled && !paused) {
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
