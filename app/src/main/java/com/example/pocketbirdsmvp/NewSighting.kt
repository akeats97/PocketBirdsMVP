package com.example.pocketbirdsmvp

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import com.example.pocketbirdsmvp.ui.theme.PocketBirdsMVPTheme
import com.example.pocketbirdsmvp.ui.theme.loraFontFamily

@Composable
fun NewSighting(viewModel: BirdViewModel){
    var dateText by remember { mutableStateOf("") }
    var birdNameText by remember { mutableStateOf("") }

    Column(
        //    modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .background(Color.Black)
    ) {
        //create Bird Name text input

        OutlinedTextField(
            value = birdNameText,
            onValueChange = { birdNameText = it},
            label = { Text("Bird Name") }
        )

        //create Date text input

        OutlinedTextField(
            value = dateText,
            onValueChange = { dateText = it},
            label = { Text("Date") }
        )

        Button(
            onClick = {
                viewModel.submitSighting(birdNameText, dateText)
                birdNameText = ""
                dateText = ""
            },
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFDDA800),
                contentColor = Color.Black
            )
        ){
            Text(text = "Submit", fontFamily = loraFontFamily)
        }

    }
}
