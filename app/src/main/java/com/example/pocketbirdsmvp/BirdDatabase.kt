package com.example.pocketbirdsmvp

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [BirdSighting::class], version = 1)
abstract class BirdDatabase : RoomDatabase() {
    abstract fun birdSightingDao(): BirdSightingDao

    companion object {
        @Volatile
        private var INSTANCE: BirdDatabase? = null

        fun getDatabase(context: Context): BirdDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    BirdDatabase::class.java,
                    "bird_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}