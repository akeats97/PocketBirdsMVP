package com.example.pocketbirdsmvp

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "bird_sightings")
data class BirdSighting(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    @ColumnInfo(name = "bird_name") val birdName: String,
    @ColumnInfo(name = "date") val date: String,
    @ColumnInfo(name = "location") val location: String?

    //@ColumnInfo(name = "image_path") val imagePath: String? = null
)