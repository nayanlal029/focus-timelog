package com.focuslog.wear.presentation

import android.app.RemoteInput
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text
import androidx.wear.input.RemoteInputIntentHelper

private const val KEY_IDENTIFIER = "identifier"
private const val KEY_PASSWORD = "password"

@Composable
fun SignInScreen(
    loading: Boolean,
    onSignIn: () -> Unit,
    onEmailSignIn: (email: String, password: String) -> Unit = { _, _ -> },
    onHandleSignIn: (handle: String, password: String) -> Unit = { _, _ -> },
    error: String? = null,
) {
    val listState = rememberScalingLazyListState()
    var useHandle by remember { mutableStateOf(true) } // User ID mode is now the default
    var identifier by remember { mutableStateOf("") }  // email or handle depending on mode
    var password by remember { mutableStateOf("") }

    val identifierLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val bundle = RemoteInput.getResultsFromIntent(result.data ?: return@rememberLauncherForActivityResult)
        identifier = bundle?.getCharSequence(KEY_IDENTIFIER)?.toString() ?: identifier
    }
    val passwordLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val bundle = RemoteInput.getResultsFromIntent(result.data ?: return@rememberLauncherForActivityResult)
        password = bundle?.getCharSequence(KEY_PASSWORD)?.toString() ?: password
    }

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
    ) {
        item {
            ListHeader { Text("Focus Log") }
        }

        if (loading) {
            item { CircularProgressIndicator() }
        } else {
            item {
                Text(
                    text = "Sign in to sync your data",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }

            // ── Mode toggle: User ID / Email ───────────────────────────────
            item {
                androidx.compose.foundation.layout.Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp),
                ) {
                    Chip(
                        modifier = Modifier.weight(1f),
                        label = { Text("User ID", fontSize = 11.sp) },
                        colors = if (useHandle) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                        onClick = { useHandle = true; identifier = "" },
                    )
                    Chip(
                        modifier = Modifier.weight(1f),
                        label = { Text("Email", fontSize = 11.sp) },
                        colors = if (!useHandle) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                        onClick = { useHandle = false; identifier = "" },
                    )
                }
            }

            // ── Identifier chip ────────────────────────────────────────────
            item {
                val placeholder = if (useHandle) "Tap to enter User ID" else "Tap to enter email"
                val label = if (useHandle) "User ID" else "Email"
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = {
                        Text(
                            text = if (identifier.isBlank()) placeholder else identifier,
                            color = if (identifier.isBlank()) FocusColors.Neutral else FocusColors.Focus,
                            fontSize = 12.sp,
                        )
                    },
                    colors = ChipDefaults.secondaryChipColors(),
                    onClick = {
                        val ri = RemoteInput.Builder(KEY_IDENTIFIER).setLabel(label).build()
                        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                        RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(ri))
                        identifierLauncher.launch(intent)
                    },
                )
            }

            // ── Password chip ──────────────────────────────────────────────
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = {
                        Text(
                            text = if (password.isBlank()) "Tap to enter password" else "•".repeat(password.length),
                            color = if (password.isBlank()) FocusColors.Neutral else FocusColors.Focus,
                            fontSize = 12.sp,
                        )
                    },
                    colors = ChipDefaults.secondaryChipColors(),
                    onClick = {
                        val ri = RemoteInput.Builder(KEY_PASSWORD).setLabel("Password").build()
                        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                        RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(ri))
                        passwordLauncher.launch(intent)
                    },
                )
            }

            // ── Sign in button ─────────────────────────────────────────────
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(if (useHandle) "Sign in with User ID" else "Sign in with email") },
                    enabled = identifier.isNotBlank() && password.isNotBlank(),
                    colors = ChipDefaults.primaryChipColors(),
                    onClick = {
                        if (useHandle) onHandleSignIn(identifier, password)
                        else onEmailSignIn(identifier, password)
                    },
                )
            }

            // ── Google fallback ────────────────────────────────────────────
            item {
                Text(
                    text = "or",
                    fontSize = 11.sp,
                    color = FocusColors.Neutral,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            item {
                Button(
                    onClick = onSignIn,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    colors = ButtonDefaults.secondaryButtonColors(),
                ) {
                    Text("Sign in with Google", fontSize = 11.sp)
                }
            }

            if (error != null) {
                item {
                    Text(
                        text = error,
                        color = FocusColors.Distraction,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }
            }
        }
    }
}
