package com.focuslog.wear.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.focuslog.wear.viewmodel.AuthState
import com.focuslog.wear.viewmodel.AuthViewModel
import com.focuslog.wear.viewmodel.TimerPhase
import com.focuslog.wear.viewmodel.TimerViewModel

private object Routes {
    const val PICKER = "picker"
    const val TIMER = "timer"
    const val STOP = "stop"
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { FocusApp() } }
    }
}

@Composable
fun FocusApp(
    authVm: AuthViewModel = viewModel(),
    timerVm: TimerViewModel = viewModel(),
) {
    val authState by authVm.state.collectAsStateWithLifecycle()

    when (authState) {
        AuthState.LOADING -> SignInScreen(loading = true, onSignIn = {})
        AuthState.SIGNED_OUT -> SignInScreen(loading = false, onSignIn = authVm::signIn)
        AuthState.SIGNED_IN -> SignedInApp(timerVm)
    }
}

@Composable
private fun SignedInApp(timerVm: TimerViewModel) {
    val nav = rememberSwipeDismissableNavController()
    val categories by timerVm.categories.collectAsStateWithLifecycle()
    val active by timerVm.active.collectAsStateWithLifecycle()
    val now by timerVm.now.collectAsStateWithLifecycle()

    SwipeDismissableNavHost(
        navController = nav,
        startDestination = Routes.PICKER,
    ) {
        composable(Routes.PICKER) {
            CategoryPickerScreen(
                categories = categories,
                runningName = active?.categoryName,
                onResumeRunning = { nav.navigate(Routes.TIMER) },
                onPick = { category ->
                    timerVm.startActivity(category)
                    nav.navigate(Routes.TIMER)
                },
            )
        }

        composable(Routes.TIMER) {
            val a = active
            if (a == null) {
                // Timer ended elsewhere — fall back home.
                nav.popBackStack(Routes.PICKER, inclusive = false)
            } else {
                ActiveTimerScreen(
                    active = a,
                    now = now,
                    onPauseResume = {
                        if (a.phase == TimerPhase.RUNNING) timerVm.pause() else timerVm.resume()
                    },
                    onStop = { nav.navigate(Routes.STOP) },
                )
            }
        }

        composable(Routes.STOP) {
            val a = active
            if (a == null) {
                nav.popBackStack(Routes.PICKER, inclusive = false)
            } else {
                StopConfirmScreen(
                    categoryName = a.categoryName,
                    durationMs = a.focusElapsed(now),
                    onConfirm = {
                        timerVm.stop()
                        nav.popBackStack(Routes.PICKER, inclusive = false)
                    },
                    onCancel = { nav.popBackStack() },
                )
            }
        }
    }
}
