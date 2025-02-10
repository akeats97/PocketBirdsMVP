package com.example.pocketbirdsmvp

import androidx.room.ColumnInfo

data class BirdSightingCount(
    @ColumnInfo(name = "bird_name") val birdName: String,
    @ColumnInfo(name = "sighting_count") val sightingCount: Int
)