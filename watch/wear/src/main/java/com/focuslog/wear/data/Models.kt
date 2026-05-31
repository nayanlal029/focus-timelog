package com.focuslog.wear.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class CategoryType(val wire: String) {
    FOCUS("focus"),
    DISTRACTION("distraction"),
    NEUTRAL("neutral");

    companion object {
        fun from(wire: String): CategoryType =
            entries.firstOrNull { it.wire == wire } ?: NEUTRAL
    }
}

const val BREAK_CATEGORY_ID = "__break__"
const val BREAK_CATEGORY_NAME = "Break"

data class Category(
    val id: String,
    val name: String,
    val type: CategoryType,
    val order: Int,
)

@Serializable
data class CategoryRow(
    val id: String,
    val name: String,
    val type: String,
    @SerialName("order") val order: Int = 0,
)

@Serializable
data class CategoryInsert(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val type: String,
    @SerialName("order") val order: Int = 999,
    val builtin: Boolean = false,
)

@Serializable
data class TimeBlockInsert(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("category_id") val categoryId: String,
    @SerialName("category_name") val categoryName: String,
    val type: String,
    @SerialName("start_ms") val startMs: Long,
    @SerialName("end_ms") val endMs: Long,
    val note: String? = null,
    val link: String? = null,
    @SerialName("is_break") val isBreak: Boolean = false,
)

/** Read-only shape for summary queries — only columns we aggregate over. */
@Serializable
data class TimeBlockRow(
    @SerialName("category_name") val categoryName: String,
    val type: String,
    @SerialName("start_ms") val startMs: Long,
    @SerialName("end_ms") val endMs: Long,
) {
    val durationMs: Long get() = (endMs - startMs).coerceAtLeast(0)
}
