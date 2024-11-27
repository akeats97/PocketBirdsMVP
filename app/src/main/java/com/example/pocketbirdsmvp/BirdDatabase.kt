package com.example.pocketbirdsmvp

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [BirdSighting::class], version = 2)
abstract class BirdDatabase : RoomDatabase() {
    abstract fun birdSightingDao(): BirdSightingDao

    companion object {
        @Volatile
        private var INSTANCE: BirdDatabase? = null

        // Define the migration from version 1 to 2
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Use the correct table name: bird_sightings
                database.execSQL("ALTER TABLE bird_sightings ADD COLUMN location TEXT")
            }
        }

        fun getDatabase(context: Context): BirdDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    BirdDatabase::class.java,
                    "bird_database"
                )
                    .addMigrations(MIGRATION_1_2)  // Add the migration to the builder
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}