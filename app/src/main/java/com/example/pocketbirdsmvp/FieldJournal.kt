package com.example.pocketbirdsmvp

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

/*
enum class BirdScreens(){
    Screen1,
    Screen2
}
 */

@Composable
fun FieldJournal(navController: NavHostController = rememberNavController()){

    /*
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .background(Color.Black)
    ) {
        Text("Field Journal")
    }
     */

    Column(
        modifier = Modifier
            .background(Color.Black)
            .padding(16.dp)
    ) {
        for (i in 1..20){
            Text(text = "Bird logs")
        }
    }

}