package com.focuslog.wear.util

import android.content.Context
import android.os.VibrationEffect
import android.os.VibratorManager

/**
 * Configurable check-in buzz: [repeats] groups of a strong pulse, amplitude from [intensity]
 * (0 = Light, 1 = Medium, 2 = Strong). Shared by the foreground service (which owns reminder
 * scheduling) so the user feels the same buzz whether the app is open or not. Distinct from the
 * Pomodoro 3×3×3 and the start single-shot.
 */
fun vibrateCheckIn(context: Context, repeats: Int, intensity: Int) {
    runCatching {
        val amp = when (intensity) {
            0 -> 90      // Light
            1 -> 170     // Medium
            else -> 255  // Strong (max)
        }
        val count = repeats.coerceIn(1, 10)
        val timings = ArrayList<Long>(count * 3)
        val amps = ArrayList<Int>(count * 3)
        repeat(count) {
            // 0ms lead, 200ms strong pulse, 150ms gap — clearly felt and repeats N times.
            timings.add(0L);   amps.add(0)
            timings.add(200L); amps.add(amp)
            timings.add(150L); amps.add(0)
        }
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        vm.defaultVibrator.vibrate(
            VibrationEffect.createWaveform(timings.toLongArray(), amps.toIntArray(), -1)
        )
    }
}
