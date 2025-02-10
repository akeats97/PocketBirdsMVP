package com.example.pocketbirdsmvp

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [BirdSighting::class], version = 2) //increment this version any time you make an update to the database schema! or if the data is not important, wipe the data on the phone using ADB from command prompt
abstract class BirdDatabase : RoomDatabase() {
    abstract fun birdSightingDao(): BirdSightingDao

    companion object {
        @Volatile
        private var INSTANCE: BirdDatabase? = null

        // Define the migration from version 1 to 2
        /*
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Check if the column exists before adding it
                val cursor = database.query("PRAGMA table_info(bird_sightings)")
                var columnExists = false

                while (cursor.moveToNext()) {
                    val columnIndex = cursor.getColumnIndex("location")
                    if (columnIndex >= 0) { // Ensure column index is valid
                        columnExists = true
                        break
                    }
                }
                cursor.close()

                // Only add the column if it doesn't exist
                if (!columnExists) {
                    database.execSQL("ALTER TABLE bird_sightings ADD COLUMN location TEXT DEFAULT 'undefined'")
                }
            }
        }
         */
        fun getDatabase(context: Context): BirdDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    BirdDatabase::class.java,
                    "bird_database"
                )
                 //   .addMigrations(MIGRATION_1_2)  // Add the migration to the builder
                    .fallbackToDestructiveMigration()  // Wipes the database if schema changes
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}