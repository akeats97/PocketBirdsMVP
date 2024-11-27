package com.example.pocketbirdsmvp

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.File


class BirdRepository(context: Context) {
    private val birdSightingDao: BirdSightingDao = BirdDatabase.getDatabase(context).birdSightingDao()
    val allSightings: Flow<List<BirdSighting>> = birdSightingDao.getAllSightings()

    suspend fun insertBirdSighting(birdName: String, date: String, location: String) {
        val sighting = BirdSighting(birdName = birdName, date = date, location = location)
        birdSightingDao.insert(sighting)
    }
}