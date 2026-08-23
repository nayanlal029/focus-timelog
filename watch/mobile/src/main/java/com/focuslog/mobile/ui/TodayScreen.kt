@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.focuslog.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.focuslog.core.data.CategoryType
import com.focuslog.core.data.TimeBlockFull
import java.util.Calendar

@Composable
fun TodayScreen(
    blocks: List<TimeBlockFull>,
    loading: Boolean,
    onRefresh: () -> Unit,
    onDelete: (TimeBlockFull) -> Unit,
    onUpdateTimes: (TimeBlockFull, Long, Long) -> Unit,
) {
    var editing by remember { mutableStateOf<TimeBlockFull?>(null) }
    var deleting by remember { mutableStateOf<TimeBlockFull?>(null) }

    Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Today", style = MaterialTheme.typography.titleLarge)
            IconButton(onClick = onRefresh) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
            }
        }

        // Focus / distraction / break totals for the day
        val focusMs = blocks.filter { it.type == CategoryType.FOCUS.wire && !it.isBreak }.sumOf { it.durationMs }
        val distrMs = blocks.filter { it.type == CategoryType.DISTRACTION.wire && !it.isBreak }.sumOf { it.durationMs }
        val breakMs = blocks.filter { it.isBreak }.sumOf { it.durationMs }
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Focus ${fmtDuration(focusMs)}", color = FocusGreen, style = MaterialTheme.typography.bodyMedium)
            if (distrMs > 0) Text("Distraction ${fmtDuration(distrMs)}", color = DistractionRed, style = MaterialTheme.typography.bodyMedium)
            if (breakMs > 0) Text("Break ${fmtDuration(breakMs)}", color = NeutralGray, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(12.dp))

        if (loading && blocks.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Column
        }
        if (blocks.isEmpty()) {
            Text(
                "Nothing logged yet today.\nStart a timer on the Timer tab (or your watch).",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@Column
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(blocks, key = { it.id }) { block ->
                BlockRow(
                    block = block,
                    onEdit = { editing = block },
                    onDelete = { deleting = block },
                )
            }
        }
    }

    editing?.let { block ->
        EditTimesDialog(
            block = block,
            onDismiss = { editing = null },
            onSave = { s, e ->
                onUpdateTimes(block, s, e)
                editing = null
            },
        )
    }

    deleting?.let { block ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete block?") },
            text = { Text("${block.categoryName}  ${fmtClock(block.startMs)}–${fmtClock(block.endMs)} (${fmtDuration(block.durationMs)})") },
            confirmButton = {
                TextButton(onClick = { onDelete(block); deleting = null }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun BlockRow(
    block: TimeBlockFull,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val type = CategoryType.from(block.type)
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(10.dp)
                    .background(if (block.isBreak) NeutralGray else colorForType(type), CircleShape)
            )
            Spacer(Modifier.size(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    block.categoryName,
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (block.isBreak) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "${fmtClock(block.startMs)} – ${fmtClock(block.endMs)}  ·  ${fmtDuration(block.durationMs)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontFamily = FontFamily.Monospace,
                )
            }
            IconButton(onClick = onEdit) {
                Icon(Icons.Filled.Edit, contentDescription = "Edit", modifier = Modifier.size(18.dp))
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

/** Edit start/end as HH:mm on today's date. */
@Composable
private fun EditTimesDialog(
    block: TimeBlockFull,
    onDismiss: () -> Unit,
    onSave: (Long, Long) -> Unit,
) {
    var startText by remember { mutableStateOf(fmtClock(block.startMs)) }
    var endText by remember { mutableStateOf(fmtClock(block.endMs)) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit ${block.categoryName}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = startText,
                    onValueChange = { startText = it },
                    label = { Text("Start (HH:mm)") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = endText,
                    onValueChange = { endText = it },
                    label = { Text("End (HH:mm)") },
                    singleLine = true,
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val s = parseClockOn(block.startMs, startText)
                val e = parseClockOn(block.endMs, endText)
                when {
                    s == null || e == null -> error = "Use HH:mm (e.g. 09:30)"
                    e <= s -> error = "End must be after start"
                    else -> onSave(s, e)
                }
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Parse "HH:mm" onto the same calendar day as [baseMs]; null if malformed. */
private fun parseClockOn(baseMs: Long, text: String): Long? {
    val m = Regex("^(\\d{1,2}):(\\d{2})$").find(text.trim()) ?: return null
    val (h, min) = m.destructured
    val hour = h.toInt()
    val minute = min.toInt()
    if (hour !in 0..23 || minute !in 0..59) return null
    return Calendar.getInstance().apply {
        timeInMillis = baseMs
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}
