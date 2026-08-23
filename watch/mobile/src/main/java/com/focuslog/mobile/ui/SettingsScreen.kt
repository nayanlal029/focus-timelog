@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.focuslog.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Watch
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.focuslog.mobile.viewmodel.WatchPushState

@Composable
fun SettingsScreen(
    email: String?,
    handle: String?,
    watchPush: WatchPushState,
    pendingCount: Int,
    onPushToWatch: () -> Unit,
    onRetrySync: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.titleLarge)

        // ── Account ──────────────────────────────────────────────────────────
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Account", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(8.dp))
                Text(email ?: "—", style = MaterialTheme.typography.bodyMedium)
                handle?.let {
                    Text(
                        "ID: $it",
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                        color = FocusGreen,
                    )
                }
            }
        }

        // ── Watch ────────────────────────────────────────────────────────────
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Galaxy Watch", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(4.dp))
                Text(
                    when (watchPush) {
                        WatchPushState.IDLE -> "Sign-in is sent to the watch automatically."
                        WatchPushState.SENDING -> "Sending sign-in to watch…"
                        WatchPushState.SENT -> "✓ Sign-in delivered — the watch signs in on its own."
                        WatchPushState.FAILED -> "Couldn't reach the watch. Check pairing and retry."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (watchPush == WatchPushState.FAILED)
                        MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onPushToWatch) {
                    Icon(Icons.Filled.Watch, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(8.dp))
                    Text("Send sign-in to watch again")
                }
            }
        }

        // ── Sync ─────────────────────────────────────────────────────────────
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Sync", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(4.dp))
                Text(
                    if (pendingCount > 0) "$pendingCount block(s) waiting to upload" else "All synced",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (pendingCount > 0) {
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = onRetrySync) {
                        Icon(Icons.Filled.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("Sync now")
                    }
                }
            }
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
            ),
        ) {
            Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text("Sign out (also signs out the watch)")
        }
    }
}
