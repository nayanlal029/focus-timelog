package com.focuslog.wear.presentation

import android.app.Activity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material.icons.filled.Stop
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
import androidx.wear.compose.material.Icon
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
    isAmbient: Boolean,
    alertFlow: SharedFlow<WatchAlert>,
    onPauseResume: () -> Unit,
    onStop: () -> Unit,
    onSnoozeCheckIn: () -> Unit,
) {
    val paused = active.phase == TimerPhase.PAUSED
    val focusMs = active.focusElapsed(now)
    val breakMs = active.breakElapsed(now)

    // Pomodoro: countdown is per-cycle (rebased on each Resume Focus). Break counts down too; once
    // it overflows the configured window, the extra time is "distraction".
    val cycleFocusMs = (focusMs - active.pomodoroWorkBaseMs).coerceAtLeast(0)
    val workRemaining = (pomodoroWorkMs - cycleFocusMs).coerceAtLeast(0)
    val breakRemaining = pomodoroBreakMs - breakMs            // negative once break is over
    val distractionOverflow = (breakMs - pomodoroBreakMs).coerceAtLeast(0)

    // Keep screen on for the entire timer session; the OS handles ambient/dim naturally.
    val window = (LocalContext.current as? Activity)?.window
    LaunchedEffect(Unit) {
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
    DisposableEffect(Unit) {
        onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }

    // Alert dialog state
    var alertMessage by remember { mutableStateOf<String?>(null) }
    var currentAlert by remember { mutableStateOf<WatchAlert?>(null) }
    LaunchedEffect(alertFlow) {
        alertFlow.collect { alert ->
            currentAlert = alert
            alertMessage = when (alert) {
                WatchAlert.DistractionThreshold -> "5 min break!\nBack to work?"
                WatchAlert.PomodoroWorkDone -> "${fmtDuration(pomodoroWorkMs)} done!\nTake a break."
                WatchAlert.PomodoroBreakDone -> "Break over!\nTime to focus."
                WatchAlert.FocusCheckIn -> "Still focusing on\n${active.categoryName}?"
                WatchAlert.BreakCheckIn -> "Still on break?"
            }
        }
    }

    val wallClock = remember(now) {
        java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date(now))
    }

    // Tap anywhere to toggle minimal mode (timer + clock only, no buttons)
    // Tapping again, or when screen wakes from ambient, restores the full UI
    var minimal by remember { mutableStateOf(false) }
    LaunchedEffect(isAmbient) { if (!isAmbient) minimal = false }

    if (isAmbient) {
        // Minimal ambient display: black bg, large white timer, tiny dim clock
        val displayMs = when {
            pomodoroEnabled && !paused -> workRemaining
            pomodoroEnabled && paused  -> breakRemaining.coerceAtLeast(0)
            else                       -> focusMs
        }
        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = fmtHMS(displayMs),
                    color = Color.White,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = wallClock,
                    color = Color(0xFF555555),
                    fontSize = 10.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
        return
    }

    if (alertMessage != null) {
        val isCheckIn = currentAlert == WatchAlert.FocusCheckIn || currentAlert == WatchAlert.BreakCheckIn
        Alert(
            title = { Text("⏰ Alert", textAlign = TextAlign.Center) },
            negativeButton = {
                Button(
                    onClick = {
                        if (isCheckIn) onSnoozeCheckIn()
                        alertMessage = null
                        currentAlert = null
                    },
                    colors = ButtonDefaults.secondaryButtonColors(),
                ) {
                    Icon(
                        imageVector = if (isCheckIn) Icons.Filled.Snooze else Icons.Filled.Check,
                        contentDescription = if (isCheckIn) "Snooze 10 min" else "Dismiss",
                        modifier = Modifier.size(24.dp),
                    )
                }
            },
            positiveButton = {
                Button(
                    onClick = {
                        if (currentAlert != WatchAlert.FocusCheckIn) onPauseResume()
                        alertMessage = null
                        currentAlert = null
                    },
                    colors = ButtonDefaults.primaryButtonColors(),
                ) {
                    Icon(
                        imageVector = when (currentAlert) {
                            WatchAlert.FocusCheckIn -> Icons.Filled.Check
                            WatchAlert.BreakCheckIn -> Icons.Filled.PlayArrow
                            else -> if (paused) Icons.Filled.PlayArrow else Icons.Filled.Pause
                        },
                        contentDescription = when (currentAlert) {
                            WatchAlert.FocusCheckIn -> "OK, still focusing"
                            WatchAlert.BreakCheckIn -> "Resume"
                            else -> if (paused) "Resume" else "Pause"
                        },
                        modifier = Modifier.size(24.dp),
                    )
                }
            },
        ) {
            Text(
                text = alertMessage ?: "",
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.body2
            )
        }
    } else if (minimal) {
        // Minimal view: tap anywhere to restore full UI
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable { minimal = false },
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = wallClock,
                    color = FocusColors.Neutral,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
                val displayMs = when {
                    pomodoroEnabled && !paused -> workRemaining
                    pomodoroEnabled && paused  -> breakRemaining.coerceAtLeast(0)
                    else                       -> focusMs
                }
                Text(
                    text = fmtHMS(displayMs),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (pomodoroEnabled && !paused && workRemaining < 60_000L)
                        FocusColors.Distraction else Color.White,
                )
            }
        }
    } else {
        // Full UI: tap anywhere outside buttons to go minimal
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp)
                .clickable { minimal = true },
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = wallClock,
                color = FocusColors.Neutral,
                fontSize = 10.sp,
                modifier = Modifier.padding(bottom = 2.dp),
            )
            Text(
                text = active.categoryName,
                color = FocusColors.forType(active.type),
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
            )

            if (pomodoroEnabled && paused) {
                // Pomodoro break: count the break window down; once it's spent, the overflow is
                // distraction (red, counting up).
                if (breakRemaining > 0L) {
                    Text(
                        text = fmtHMS(breakRemaining),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold,
                        color = FocusColors.Neutral,
                    )
                    Text(text = "☕ break", fontSize = 11.sp, color = FocusColors.Neutral)
                } else {
                    Text(
                        text = fmtHMS(distractionOverflow),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold,
                        color = FocusColors.Distraction,
                    )
                    Text(text = "⚠ distraction", fontSize = 11.sp, color = FocusColors.Distraction)
                }
            } else if (pomodoroEnabled && !paused) {
                Text(
                    text = fmtHMS(workRemaining),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (workRemaining < 60_000L) FocusColors.Distraction else FocusColors.Focus,
                )
                Text(text = "🍅 remaining", fontSize = 11.sp, color = FocusColors.Neutral)
            } else {
                Text(
                    text = fmtHMS(focusMs),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                )
                if (paused) {
                    Text(
                        text = "Break  ${fmtHMS(breakMs)}",
                        color = FocusColors.Distraction,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }

            Row(
                modifier = Modifier.padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(
                    onClick = onPauseResume,
                    colors = ButtonDefaults.secondaryButtonColors(),
                ) {
                    Icon(
                        imageVector = if (paused) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                        contentDescription = if (paused) {
                            if (pomodoroEnabled) "Resume focus" else "Resume"
                        } else "Pause",
                        modifier = Modifier.size(24.dp),
                    )
                }

                Button(
                    onClick = onStop,
                    colors = ButtonDefaults.primaryButtonColors(),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Stop,
                        contentDescription = "Stop",
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
        }
    }
}
