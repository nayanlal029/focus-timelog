package com.focuslog.wear.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.dialog.Alert
import com.focuslog.wear.util.fmtDuration

/** Confirm before logging the block. No note field — there is no keyboard on the watch. */
@Composable
fun StopConfirmScreen(
    categoryName: String,
    durationMs: Long,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    Alert(
        title = { Text("Stop \"$categoryName\"?") },
        content = { Text("Duration: ${fmtDuration(durationMs)}") },
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = onConfirm,
                    colors = ButtonDefaults.primaryButtonColors(),
                    modifier = Modifier.padding(end = 4.dp),
                ) { Text("Yes") }
                Button(
                    onClick = onCancel,
                    colors = ButtonDefaults.secondaryButtonColors(),
                ) { Text("Cancel") }
            }
        }
    }
}
