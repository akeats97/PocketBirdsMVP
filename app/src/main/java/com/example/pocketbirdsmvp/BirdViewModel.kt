package com.example.pocketbirdsmvp

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

//gives us functions to interact with the repository which in tern interacts with the database
class BirdViewModel(private val repository: BirdRepository) : ViewModel() {
    val allSightings: StateFlow<List<BirdSighting>> = repository.allSightings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun submitSighting(birdName: String, date: String) {
        viewModelScope.launch {
            repository.insertBirdSighting(birdName, date)
        }
    }
}

