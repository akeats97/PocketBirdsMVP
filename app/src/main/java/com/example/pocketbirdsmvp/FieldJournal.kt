package com.example.pocketbirdsmvp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController


enum class BirdScreens(){
    Screen1,
    Screen2
}

@Composable
fun FieldJournal(navController: NavHostController = rememberNavController()){
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {}
    NavHost(
        navController = navController,
        startDestination = BirdScreens.Screen1.name,
        modifier = Modifier.fillMaxSize()
    ){
        composable(route = BirdScreens.Screen1.name){
            NewSighting(onNextButtonClicked = {navController.navigate(BirdScreens.Screen2.name)})
        }
        composable(route = BirdScreens.Screen2.name){
            BirdDex(onNextButtonClicked = {navController.navigate(BirdScreens.Screen1.name)})
        }
    }
}