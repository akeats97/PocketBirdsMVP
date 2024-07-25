package com.example.pocketbirdsmvp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider


//creates BirdViewModels
class BirdViewModelFactory(private val repository: BirdRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(BirdViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return BirdViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}