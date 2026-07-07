@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.focuslog.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

/**
 * Phone sign-in. Sign in ONCE here and the watch signs in automatically over the Data Layer —
 * never type credentials on the watch again.
 */
@Composable
fun SignInScreen(
    loading: Boolean,
    error: String?,
    onEmailSignIn: (String, String) -> Unit,
    onHandleSignIn: (String, String) -> Unit,
    onGoogleSignIn: () -> Unit,
) {
    var useHandle by remember { mutableStateOf(true) }
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("FocusLog", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(4.dp))
        Text(
            "Sign in once — your watch signs in automatically.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        if (loading) {
            CircularProgressIndicator()
            return@Column
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = useHandle,
                onClick = { useHandle = true },
                label = { Text("User ID") },
            )
            FilterChip(
                selected = !useHandle,
                onClick = { useHandle = false },
                label = { Text("Email") },
            )
        }
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = { Text(if (useHandle) "User ID (e.g. nlal)" else "Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (useHandle) KeyboardType.Text else KeyboardType.Email,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))

        Button(
            onClick = {
                if (useHandle) onHandleSignIn(identifier, password)
                else onEmailSignIn(identifier, password)
            },
            enabled = identifier.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Sign in") }

        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onGoogleSignIn, modifier = Modifier.fillMaxWidth()) {
            Text("Continue with Google")
        }

        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}
