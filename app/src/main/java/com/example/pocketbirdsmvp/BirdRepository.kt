package com.example.pocketbirdsmvp

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

class BirdRepository(context: Context) {
    private val birdSightingDao: BirdSightingDao = BirdDatabase.getDatabase(context).birdSightingDao()
    private val birdCsvReader = BirdCsvReader(context)

    val allSightings: Flow<List<BirdSighting>> = birdSightingDao.getAllSightings()

    // New method for BirdDex
    fun getBirdDexEntries(): Flow<List<BirdDexEntry>> = flow {
        val allBirds = birdCsvReader.readBirdList()

        birdSightingDao.getBirdSightingCounts().collect { sightingCounts ->
            // Convert the List<BirdSightingCount> to a Map<String, Int>
            val sightingCountsMap = sightingCounts.associate { it.birdName to it.sightingCount }

            // Map allBirds to BirdDexEntries
            val entries = allBirds.map { birdName ->
                val sightingCount = sightingCountsMap[birdName] ?: 0
                BirdDexEntry(
                    birdName = birdName,
                    timesSeen = sightingCount,
                    isDiscovered = sightingCount > 0
                )
            }
            emit(entries)
        }
    }.flowOn(Dispatchers.IO)

    // Insert a new bird sighting
    suspend fun insertBirdSighting(birdName: String, date: Long, location: String) {
        val sighting = BirdSighting(birdName = birdName, date = date, location = location)
        birdSightingDao.insert(sighting)
    }
}