package com.focuslog.wear.presentation

import android.app.RemoteInput
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text
import androidx.wear.input.RemoteInputIntentHelper
import com.focuslog.wear.data.CategoryType

private const val KEY_NAME = "category_name"

/**
 * Add a new category from the watch.
 * Name is entered via the Wear OS remote text input (swipe keyboard / voice dictation).
 * Type is picked with three chip buttons.
 */
@Composable
fun AddCategoryScreen(
    saving: Boolean,
    onSave: (name: String, type: CategoryType) -> Unit,
    onCancel: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(CategoryType.FOCUS) }

    // Wear OS text input launcher — opens swipe keyboard / voice input
    val inputLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val bundle = RemoteInput.getResultsFromIntent(result.data ?: return@rememberLauncherForActivityResult)
        name = bundle?.getCharSequence(KEY_NAME)?.toString() ?: name
    }

    ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
        item { ListHeader { Text("Add Category") } }

        // Name chip — tap to open keyboard
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = {
                    Text(
                        text = if (name.isBlank()) "Tap to enter name" else name,
                        color = if (name.isBlank()) FocusColors.Neutral else FocusColors.Focus,
                        fontSize = 13.sp,
                    )
                },
                colors = ChipDefaults.secondaryChipColors(),
                onClick = {
                    val remoteInput = RemoteInput.Builder(KEY_NAME)
                        .setLabel("Category name")
                        .build()
                    val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                    RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(remoteInput))
                    inputLauncher.launch(intent)
                },
            )
        }

        // Type selector
        item {
            Text(
                text = "Type",
                fontSize = 12.sp,
                color = FocusColors.Neutral,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Focus") },
                colors = if (type == CategoryType.FOCUS) ChipDefaults.primaryChipColors()
                else ChipDefaults.chipColors(backgroundColor = FocusColors.Focus.copy(alpha = 0.15f)),
                onClick = { type = CategoryType.FOCUS },
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Distraction") },
                colors = if (type == CategoryType.DISTRACTION) ChipDefaults.primaryChipColors()
                else ChipDefaults.chipColors(backgroundColor = FocusColors.Distraction.copy(alpha = 0.15f)),
                onClick = { type = CategoryType.DISTRACTION },
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Neutral") },
                colors = if (type == CategoryType.NEUTRAL) ChipDefaults.primaryChipColors()
                else ChipDefaults.chipColors(backgroundColor = FocusColors.Neutral.copy(alpha = 0.15f)),
                onClick = { type = CategoryType.NEUTRAL },
            )
        }

        // Save / Cancel
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text(if (saving) "Saving…" else "Save") },
                enabled = name.isNotBlank() && !saving,
                colors = ChipDefaults.primaryChipColors(),
                onClick = { if (name.isNotBlank()) onSave(name.trim(), type) },
            )
        }
        item {
            Chip(
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Cancel") },
                colors = ChipDefaults.secondaryChipColors(),
                onClick = onCancel,
            )
        }
    }
}
