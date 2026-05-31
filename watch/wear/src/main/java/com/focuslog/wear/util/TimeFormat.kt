package com.focuslog.wear.util

/** Formats milliseconds as HH:MM:SS (or MM:SS under an hour), mirroring the web app's fmtHMS. */
fun fmtHMS(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

/** Short human duration like "1h 23m" / "5m", for confirmation dialogs. */
fun fmtDuration(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600
    val m = (total % 3600) / 60
    return when {
        h > 0 -> "${h}h ${m}m"
        m > 0 -> "${m}m"
        else -> "${total}s"
    }
}
