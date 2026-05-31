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

private const val KEY_EMAIL = "email"
private const val KEY_PASSWORD = "password"

@Composable
fun SignInScreen(
    loading: Boolean,
    onSignIn: () -> Unit,
    onEmailSignIn: (email: String, password: String) -> Unit = { _, _ -> },
    error: String? = null,
) {
    val listState = rememberScalingLazyListState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    val emailLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val bundle = RemoteInput.getResultsFromIntent(result.data ?: return@rememberLauncherForActivityResult)
        email = bundle?.getCharSequence(KEY_EMAIL)?.toString() ?: email
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
            item {
                Button(
                    onClick = onSignIn,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    colors = ButtonDefaults.primaryButtonColors(),
                ) {
                    Text("Sign in with Google")
                }
            }

            // --- Email/password fallback (works on the emulator, no Google account needed) ---
            item {
                Text(
                    text = "or use email",
                    fontSize = 11.sp,
                    color = FocusColors.Neutral,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = {
                        Text(
                            text = if (email.isBlank()) "Tap to enter email" else email,
                            color = if (email.isBlank()) FocusColors.Neutral else FocusColors.Focus,
                            fontSize = 12.sp,
                        )
                    },
                    colors = ChipDefaults.secondaryChipColors(),
                    onClick = {
                        val ri = RemoteInput.Builder(KEY_EMAIL).setLabel("Email").build()
                        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                        RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(ri))
                        emailLauncher.launch(intent)
                    },
                )
            }
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
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Sign in with email") },
                    enabled = email.isNotBlank() && password.isNotBlank(),
                    colors = ChipDefaults.primaryChipColors(),
                    onClick = { onEmailSignIn(email, password) },
                )
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
