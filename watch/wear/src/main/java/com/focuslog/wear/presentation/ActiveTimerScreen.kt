package com.focuslog.wear.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Text
import com.focuslog.wear.util.fmtHMS
import com.focuslog.wear.viewmodel.Active
import com.focuslog.wear.viewmodel.TimerPhase

/**
 * Active timer. Shows focus elapsed while running; while paused, shows the break/distraction
 * timer that starts the moment you pause. Large monospace digits for glanceability.
 */
@Composable
fun ActiveTimerScreen(
    active: Active,
    now: Long,
    onPauseResume: () -> Unit,
    onStop: () -> Unit,
) {
    val paused = active.phase == TimerPhase.PAUSED
    val mainMs = active.focusElapsed(now)
    val breakMs = active.breakElapsed(now)

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = active.categoryName,
            color = FocusColors.forType(active.type),
            fontWeight = FontWeight.Medium,
        )
        Text(
            text = fmtHMS(mainMs),
            fontFamily = FontFamily.Monospace,
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
        )
        if (paused) {
            Text(
                text = "On break  ${fmtHMS(breakMs)}",
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
