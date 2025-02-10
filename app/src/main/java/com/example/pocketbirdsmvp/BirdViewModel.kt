package com.example.pocketbirdsmvp

import android.net.Uri
import androidx.compose.ui.text.style.TextDecoration.Companion.combine
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

//gives us functions to interact with the repository which in tern interacts with the database
class BirdViewModel(private val repository: BirdRepository) : ViewModel() {
    val allSightings: StateFlow<List<BirdSighting>> = repository.allSightings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    private val _showOnlySeen = MutableStateFlow(false)
    val showOnlySeen = _showOnlySeen.asStateFlow()

    val birdDexEntries = combine(
        repository.getBirdDexEntries(),
        searchQuery,
        showOnlySeen
    ) { entries, query, onlySeen ->
        entries
            .filter { entry ->
                if (onlySeen) entry.isDiscovered else true
            }
            .filter { entry ->
                entry.birdName.contains(query, ignoreCase = true)
            }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun toggleShowOnlySeen() {
        _showOnlySeen.value = !_showOnlySeen.value
    }
    fun submitSighting(birdName: String, date: Long, location: String) {
        viewModelScope.launch {
            repository.insertBirdSighting(birdName, date, location)
        }
    }
}

