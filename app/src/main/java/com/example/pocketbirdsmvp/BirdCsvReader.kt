package com.example.pocketbirdsmvp

import android.content.Context

class BirdCsvReader(private val context: Context) {
    fun readBirdList(): List<String> {
        return context.assets.open("birdnames.csv").bufferedReader().useLines { lines ->
            lines.drop(1) // Skip the first line (header)
                .filter { it.isNotBlank() } // Only keep non-blank lines
                .toList() // Convert the sequence to a list
        }
    }
}