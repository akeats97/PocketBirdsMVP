package com.example.pocketbirdsmvp

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

@Composable
fun BirdDex(onNextButtonClicked: () -> Unit){
    Column (Modifier.background(Color.Cyan),verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally){
        Button(onClick = {onNextButtonClicked()}, colors = ButtonDefaults.buttonColors(containerColor = Color.Blue)){
            Text("page 2")
        }
    }
}