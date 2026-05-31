package com.focuslog.wear.presentation

import android.app.Activity
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.wear.ambient.AmbientLifecycleObserver
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.focuslog.wear.viewmodel.AuthState
import com.focuslog.wear.viewmodel.AuthViewModel
import com.focuslog.wear.viewmodel.SummaryViewModel
import com.focuslog.wear.viewmodel.TimerPhase
import com.focuslog.wear.viewmodel.TimerViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private object Routes {
    const val PICKER = "picker"
    const val TIMER = "timer"
    const val STOP = "stop"
    const val SUMMARY = "summary"
    const val DAY_SUMMARY = "day_summary"
    const val ADD_CATEGORY = "add_category"
}

class MainActivity : ComponentActivity() {

    // Activity-level ViewModel access (same instance as Compose viewModel())
    private val timerVm: TimerViewModel by viewModels()

    // Ambient state: mutated by system callback, triggers Compose recomposition
    private val isAmbientState = mutableStateOf(false)

    private val ambientObserver by lazy {
        AmbientLifecycleObserver(this, object : AmbientLifecycleObserver.AmbientLifecycleCallback {
            override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
                isAmbientState.value = true
            }
            override fun onExitAmbient() { isAmbientState.value = false }
            override fun onUpdateAmbient() {}
        })
    }

    private var navController: NavController? = null
    private var lastStemTap = 0L
    private var stemJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(ambientObserver)
        setContent {
            MaterialTheme {
                FocusApp(isAmbient = isAmbientState.value)
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        return when (keyCode) {
            // Crown / side button:
            //   single-tap → start/pause immediately (fires after 400ms debounce)
            //   double-tap  → go home (cancels pending single-tap action)
            KeyEvent.KEYCODE_STEM_PRIMARY, KeyEvent.KEYCODE_STEM_1 -> {
                val now = System.currentTimeMillis()
                if (now - lastStemTap < 400L) {
                    stemJob?.cancel()
                    lastStemTap = 0L
                    navController?.navigate(Routes.PICKER) {
                        popUpTo(Routes.PICKER) { inclusive = true }
                    }
                } else {
                    lastStemTap = now
                    stemJob?.cancel()
                    stemJob = lifecycleScope.launch {
                        delay(400)
                        timerVm.toggleStartPause()
                    }
                }
                true
            }
            // Second button — go home (backup)
            KeyEvent.KEYCODE_STEM_2 -> {
                navController?.navigate(Routes.PICKER) {
                    popUpTo(Routes.PICKER) { inclusive = true }
                }
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    @Composable
    fun FocusApp(
        isAmbient: Boolean,
        authVm: AuthViewModel = viewModel(),
    ) {
        val authState by authVm.state.collectAsStateWithLifecycle()
        val authError by authVm.error.collectAsStateWithLifecycle()
        val activity = LocalContext.current as Activity

        when (authState) {
            AuthState.LOADING -> SignInScreen(loading = true, onSignIn = {})
            AuthState.SIGNED_OUT -> SignInScreen(
                loading = false,
                onSignIn = { authVm.signIn(activity) },
                onEmailSignIn = { email, password -> authVm.signInWithEmail(email, password) },
                error = authError,
            )
            AuthState.SIGNED_IN -> SignedInApp(timerVm, isAmbient)
        }
    }

    @Composable
    private fun SignedInApp(
        timerVm: TimerViewModel,
        isAmbient: Boolean,
        summaryVm: SummaryViewModel = viewModel(),
    ) {
        val nav = rememberSwipeDismissableNavController()
        navController = nav

        val categories     by timerVm.categories.collectAsStateWithLifecycle()
        val selected       by timerVm.selectedCategory.collectAsStateWithLifecycle()
        val active         by timerVm.active.collectAsStateWithLifecycle()
        val now            by timerVm.now.collectAsStateWithLifecycle()
        val pomodoroEnabled by timerVm.pomodoroEnabled.collectAsStateWithLifecycle()
        val pomodoroWorkMs  by timerVm.pomodoroWorkMs.collectAsStateWithLifecycle()
        val pomodoroBreakMs by timerVm.pomodoroBreakMs.collectAsStateWithLifecycle()
        val pomodoroWorkMin by timerVm.pomodoroWorkMin.collectAsStateWithLifecycle()
        val pomodoroBreakMin by timerVm.pomodoroBreakMin.collectAsStateWithLifecycle()
        val sleepAfterSec    by timerVm.sleepAfterSec.collectAsStateWithLifecycle()
        val recentCategoryIds by timerVm.recentCategoryIds.collectAsStateWithLifecycle()

        SwipeDismissableNavHost(navController = nav, startDestination = Routes.PICKER) {

            composable(Routes.PICKER) {
                HomeScreen(
                    categories = categories,
                    selected = selected,
                    active = active,
                    pomodoroEnabled = pomodoroEnabled,
                    pomodoroWorkMin = pomodoroWorkMin,
                    pomodoroBreakMin = pomodoroBreakMin,
                    sleepAfterSec = sleepAfterSec,
                    recentCategoryIds = recentCategoryIds,
                    onStart = {
                        selected?.let { cat ->
                            timerVm.startActivity(cat)
                            nav.navigate(Routes.TIMER)
                        }
                    },
                    onSelect = { category ->
                        timerVm.startActivity(category)
                        nav.navigate(Routes.TIMER)
                    },
                    onResumeRunning = { nav.navigate(Routes.TIMER) },
                    onAddCategory = { nav.navigate(Routes.ADD_CATEGORY) },
                    onTogglePomodoro = timerVm::togglePomodoro,
                    onSummary = { nav.navigate(Routes.SUMMARY) },
                    onPomodoroWorkChange = timerVm::updatePomodoroWork,
                    onPomodoroBreakChange = timerVm::updatePomodoroBreak,
                    onSleepChange = timerVm::updateSleepSec,
                )
            }

            composable(Routes.TIMER) {
                val a = active
                if (a == null) {
                    nav.popBackStack(Routes.PICKER, inclusive = false)
                } else {
                    ActiveTimerScreen(
                        active = a,
                        now = now,
                        pomodoroEnabled = pomodoroEnabled,
                        pomodoroWorkMs = pomodoroWorkMs,
                        pomodoroBreakMs = pomodoroBreakMs,
                        sleepAfterSec = sleepAfterSec,
                        isAmbient = isAmbient,
                        alertFlow = timerVm.alert,
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
                            nav.navigate(Routes.DAY_SUMMARY) {
                                popUpTo(Routes.PICKER) { inclusive = false }
                            }
                        },
                        onCancel = { nav.popBackStack() },
                    )
                }
            }

            composable(Routes.DAY_SUMMARY) {
                DaySummaryScreen(
                    vm = summaryVm,
                    onViewFull = { nav.navigate(Routes.SUMMARY) },
                )
            }

            composable(Routes.SUMMARY) {
                SummaryScreen(vm = summaryVm)
            }

            composable(Routes.ADD_CATEGORY) {
                AddCategoryScreen(
                    saving = false,
                    onSave = { name, type ->
                        timerVm.addCategory(name, type)
                        nav.popBackStack()
                    },
                    onCancel = { nav.popBackStack() },
                )
            }
        }
    }
}
