package com.example.pocketbirdsmvp

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material3.Checkbox
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api

@Composable
fun BirdDex(
    viewModel: BirdViewModel,
    onBirdClick: (String) -> Unit = {} // For future detail view navigation
) {
    val birdEntries by viewModel.birdDexEntries.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val showOnlySeen by viewModel.showOnlySeen.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Search bar
        TextField(
            value = searchQuery,
            onValueChange = viewModel::updateSearchQuery,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            placeholder = { Text("Search birds...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
        )

        // "Show only seen" toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = showOnlySeen,
                onCheckedChange = { viewModel.toggleShowOnlySeen() }
            )
            Text(
                text = "Only show birds you've seen",
                modifier = Modifier.padding(start = 8.dp)
            )
        }

        // Bird list
        LazyColumn {
            items(birdEntries) { entry ->
                BirdDexEntryItem(
                    entry = entry,
                    onClick = { onBirdClick(entry.birdName) }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BirdDexEntryItem(
    entry: BirdDexEntry,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = entry.birdName,
                style = MaterialTheme.typography.bodyLarge,
                color = if (entry.isDiscovered)
                    MaterialTheme.colorScheme.onSurface
                else
                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )

            if (entry.isDiscovered) {
                Badge(
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Text(
                        text = entry.timesSeen.toString(),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }
    }
}
