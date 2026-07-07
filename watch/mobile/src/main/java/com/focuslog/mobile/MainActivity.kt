@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.focuslog.mobile

import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.focuslog.core.data.CategoryType
import com.focuslog.mobile.ui.FocusLogTheme
import com.focuslog.mobile.ui.SettingsScreen
import com.focuslog.mobile.ui.SignInScreen
import com.focuslog.mobile.ui.TimerScreen
import com.focuslog.mobile.ui.TodayScreen
import com.focuslog.mobile.viewmodel.AuthState
import com.focuslog.mobile.viewmodel.MobileAuthViewModel
import com.focuslog.mobile.viewmodel.MobileTimerViewModel

private enum class Tab { TIMER, TODAY, SETTINGS }

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            FocusLogTheme {
                FocusApp()
            }
        }
    }
}

@Composable
private fun FocusApp(authVm: MobileAuthViewModel = viewModel()) {
    val authState by authVm.state.collectAsStateWithLifecycle()
    val authError by authVm.error.collectAsStateWithLifecycle()
    val activity = LocalContext.current as Activity

    when (authState) {
        AuthState.LOADING -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        AuthState.SIGNED_OUT -> SignInScreen(
            loading = false,
            error = authError,
            onEmailSignIn = authVm::signInWithEmail,
            onHandleSignIn = authVm::signInWithHandle,
            onGoogleSignIn = { authVm.signInWithGoogle(activity) },
        )
        AuthState.SIGNED_IN -> SignedInApp(authVm)
    }
}

@Composable
private fun SignedInApp(
    authVm: MobileAuthViewModel,
    timerVm: MobileTimerViewModel = viewModel(),
) {
    var tab by rememberSaveable { mutableStateOf(Tab.TIMER) }
    var showAddCategory by remember { mutableStateOf(false) }

    val active by timerVm.active.collectAsStateWithLifecycle()
    val now by timerVm.now.collectAsStateWithLifecycle()
    val categories by timerVm.categories.collectAsStateWithLifecycle()
    val todayBlocks by timerVm.todayBlocks.collectAsStateWithLifecycle()
    val loadingBlocks by timerVm.loadingBlocks.collectAsStateWithLifecycle()
    val pendingCount by timerVm.pendingCount.collectAsStateWithLifecycle()
    val handle by authVm.handle.collectAsStateWithLifecycle()
    val watchPush by authVm.watchPush.collectAsStateWithLifecycle()

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == Tab.TIMER,
                    onClick = { tab = Tab.TIMER },
                    icon = { Icon(Icons.Filled.Timer, contentDescription = null) },
                    label = { Text("Timer") },
                )
                NavigationBarItem(
                    selected = tab == Tab.TODAY,
                    onClick = { tab = Tab.TODAY; timerVm.refreshToday() },
                    icon = { Icon(Icons.AutoMirrored.Filled.ViewList, contentDescription = null) },
                    label = { Text("Today") },
                )
                NavigationBarItem(
                    selected = tab == Tab.SETTINGS,
                    onClick = { tab = Tab.SETTINGS },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    label = { Text("Settings") },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                Tab.TIMER -> TimerScreen(
                    active = active,
                    now = now,
                    categories = categories,
                    onStart = timerVm::start,
                    onPause = timerVm::pause,
                    onResume = timerVm::resume,
                    onStop = timerVm::stop,
                    onAddCategory = { showAddCategory = true },
                )
                Tab.TODAY -> TodayScreen(
                    blocks = todayBlocks,
                    loading = loadingBlocks,
                    onRefresh = timerVm::refreshToday,
                    onDelete = timerVm::deleteBlock,
                    onUpdateTimes = timerVm::updateBlockTimes,
                )
                Tab.SETTINGS -> SettingsScreen(
                    email = authVm.email(),
                    handle = handle,
                    watchPush = watchPush,
                    pendingCount = pendingCount,
                    onPushToWatch = authVm::pushToWatch,
                    onRetrySync = timerVm::retrySync,
                    onSignOut = authVm::signOut,
                )
            }
        }
    }

    if (showAddCategory) {
        AddCategoryDialog(
            onDismiss = { showAddCategory = false },
            onSave = { name, type ->
                timerVm.addCategory(name, type)
                showAddCategory = false
            },
        )
    }
}

@Composable
private fun AddCategoryDialog(
    onDismiss: () -> Unit,
    onSave: (String, CategoryType) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(CategoryType.FOCUS) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New category") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CategoryType.entries.forEach { t ->
                        FilterChip(
                            selected = type == t,
                            onClick = { type = t },
                            label = { Text(t.wire.replaceFirstChar { it.uppercase() }) },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name.trim(), type) },
                enabled = name.isNotBlank(),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
