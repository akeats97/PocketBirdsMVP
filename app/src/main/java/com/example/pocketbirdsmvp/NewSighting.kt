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
import androidx.compose.ui.tooling.preview.Preview
import com.example.pocketbirdsmvp.ui.theme.PocketBirdsMVPTheme


@Composable
fun NewSighting(
    onNextButtonClicked: () -> Unit
){
    Column (Modifier.background(Color.Blue), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally){
        Button(onClick = {onNextButtonClicked()}, colors = ButtonDefaults.buttonColors(containerColor = Color.Red)){
            Text("page 1")
        }
    }
}

@Preview
@Composable
fun NewSightingPreview(){
    PocketBirdsMVPTheme {
        NewSighting(
            onNextButtonClicked = {}
        )
    }
}