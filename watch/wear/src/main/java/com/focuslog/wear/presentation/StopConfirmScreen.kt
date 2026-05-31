package com.focuslog.wear.presentation

import androidx.compose.runtime.Composable
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.dialog.Alert
import com.focuslog.wear.util.fmtDuration

/**
 * Confirm before logging the block.
 * Uses the correct Wear Compose Alert API: negativeButton / positiveButton / message.
 */
@Composable
fun StopConfirmScreen(
    categoryName: String,
    durationMs: Long,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    Alert(
        title = { Text("Stop \"$categoryName\"?") },
        negativeButton = {
            Button(
                onClick = onCancel,
                colors = ButtonDefaults.secondaryButtonColors(),
            ) { Text("No") }
        },
        positiveButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.primaryButtonColors(),
            ) { Text("Yes") }
        },
    ) {
        Text("Duration: ${fmtDuration(durationMs)}")
    }
}
