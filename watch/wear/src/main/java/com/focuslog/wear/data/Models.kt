package com.focuslog.wear.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Category type, mirroring the web app's `CategoryType` ("focus" | "distraction" | "neutral"). */
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

/** Domain model used by the UI. */
data class Category(
    val id: String,
    val name: String,
    val type: CategoryType,
    val order: Int,
)

/**
 * Row shape read from the `categories` table. Note the DB uses snake_case and an `order` column.
 * `order` is a reserved word in Postgres but is a valid JSON key here.
 */
@Serializable
data class CategoryRow(
    val id: String,
    val name: String,
    val type: String,
    @SerialName("order") val order: Int = 0,
) {
    fun toDomain() = Category(id = id, name = name, type = CategoryType.from(type), order = order)
}

/**
 * Insert payload for the `time_blocks` table — EXACTLY the web app's DB column names
 * (snake_case). The web app's TS domain type is camelCase, but the wire/DB shape is this.
 */
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
