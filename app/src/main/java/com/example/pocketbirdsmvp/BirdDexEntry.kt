package com.example.pocketbirdsmvp

data class BirdDexEntry(
    val birdName: String,
    val timesSeen: Int = 0,
    val isDiscovered: Boolean = false,
    // Add any additional fields from your CSV here
)