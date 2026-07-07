package com.focuslog.mobile.ui

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 1:23:45 / 12:05 style elapsed time. */
fun fmtHMS(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

/** "2h 05m" / "12m" style durations for list rows. */
fun fmtDuration(ms: Long): String {
    val totalMin = (ms / 60_000).coerceAtLeast(0)
    val h = totalMin / 60
    val m = totalMin % 60
    return if (h > 0) "${h}h %02dm".format(m) else "${m}m"
}

/** Wall-clock "14:05". */
fun fmtClock(ms: Long): String =
    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))
