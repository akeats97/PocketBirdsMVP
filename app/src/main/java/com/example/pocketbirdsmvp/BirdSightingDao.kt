package com.example.pocketbirdsmvp

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface BirdSightingDao {
    @Insert
    suspend fun insert(birdSighting: BirdSighting): Long

    @Query("SELECT * FROM bird_sightings ORDER BY date DESC")
    fun getAllSightings(): Flow<List<BirdSighting>>

    @Query("""
     SELECT bird_name, COUNT(*) as sighting_count 
     FROM bird_sightings 
     GROUP BY bird_name
    """)
    fun getBirdSightingCounts(): Flow<List<BirdSightingCount>>

}