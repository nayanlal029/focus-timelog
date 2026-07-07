package com.focuslog.wear.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.focuslog.core.data.CategoryType
import com.focuslog.core.data.SupabaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class SummaryPeriod(val label: String, val ms: Long) {
    DAY("24 h", 24 * 60 * 60 * 1000L),
    WEEK("7 days", 7 * 24 * 60 * 60 * 1000L),
}

data class CategorySummary(
    val name: String,
    val type: CategoryType,
    val totalMs: Long,
)

sealed interface SummaryUiState {
    object Loading : SummaryUiState
    data class Ready(val items: List<CategorySummary>, val totalFocusMs: Long) : SummaryUiState
    data class Error(val message: String) : SummaryUiState
}

class SummaryViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = SupabaseRepository(app)

    private val _period = MutableStateFlow(SummaryPeriod.DAY)
    val period: StateFlow<SummaryPeriod> = _period.asStateFlow()

    private val _state = MutableStateFlow<SummaryUiState>(SummaryUiState.Loading)
    val state: StateFlow<SummaryUiState> = _state.asStateFlow()

    private var lastRefreshAt = 0L
    private val refreshThrottleMs = 5 * 60 * 1_000L

    init { load() }

    fun setPeriod(p: SummaryPeriod) {
        if (_period.value == p) return
        _period.value = p
        load()
    }

    fun refresh() {
        val now = System.currentTimeMillis()
        if (now - lastRefreshAt < refreshThrottleMs && _state.value is SummaryUiState.Ready) return
        load()
    }

    private fun load() {
        lastRefreshAt = System.currentTimeMillis()
        _state.value = SummaryUiState.Loading
        viewModelScope.launch {
            val startMs = System.currentTimeMillis() - _period.value.ms
            repo.fetchSummary(startMs).fold(
                onSuccess = { rows ->
                    val items = rows
                        .filter { it.durationMs > 0 }
                        .groupBy { it.categoryName }
                        .map { (name, blocks) ->
                            CategorySummary(
                                name = name,
                                type = CategoryType.from(blocks.first().type),
                                totalMs = blocks.sumOf { it.durationMs },
                            )
                        }
                        .sortedByDescending { it.totalMs }
                    val focusTotal = items
                        .filter { it.type == CategoryType.FOCUS }
                        .sumOf { it.totalMs }
                    _state.value = SummaryUiState.Ready(items, focusTotal)
                },
                onFailure = {
                    _state.value = SummaryUiState.Error(it.message ?: "Failed to load")
                }
            )
        }
    }
}
