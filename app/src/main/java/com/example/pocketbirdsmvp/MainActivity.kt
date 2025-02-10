package com.example.pocketbirdsmvp
/*
NOTES ON RUNNING - If getting DB error or migration error and data on device does not matter then do these steps:
1. While app is installed on device and device is plugged into computer open command prompt
2. cd C:\Users\akeats97\AppData\Local\Android\Sdk\platform-tools
3. adb shell pm clear com.example.pocketbirdsmvp

This will wipe all local memory of the last db and create a new one!
 */



import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.pocketbirdsmvp.ui.theme.PocketBirdsMVPTheme
import com.example.pocketbirdsmvp.ui.theme.loraFontFamily


class MainActivity : ComponentActivity() {
    //create the view model that we will use to access the data. To do this we use a Factory and a Repository for reasons I'm not quite sure yet
    private val viewModel: BirdViewModel by viewModels {
        BirdViewModelFactory(BirdRepository(applicationContext))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PocketBirdsMVPTheme {
                BirdApp(viewModel = viewModel)
            }
        }
    }
}

enum class BirdScreens  {
    FieldJournal,
    NewSighting,
    BirdDex
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BirdApp(navController: NavHostController = rememberNavController(), viewModel: BirdViewModel){
    Scaffold(
        topBar = {
                 TopAppBar(
                     colors = TopAppBarDefaults.smallTopAppBarColors(containerColor = Color.Black, titleContentColor = Color.White),
                     title = { Text("Pocket Birds", fontFamily = loraFontFamily, fontWeight = FontWeight.Bold) }//at some point this should pull from a list of strings on the resource fill and put the accurate title
                 )
        },
        bottomBar = {
            BottomAppBar(
                containerColor = Color.Black // Set the background color of the bottom bar
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround // Distribute buttons evenly
                ) {
                    Button(
                        onClick = { navController.navigate(BirdScreens.FieldJournal.name) }, //this button needs to go to the field journal screen
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.profilebutton),
                            contentDescription = "Bird Dex"
                        )
                    }
                    Button(
                        onClick = { navController.navigate(BirdScreens.NewSighting.name) }, //this button needs to go to the new sighting screen
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.newsightingbutton),
                            contentDescription = "New Sighting"
                        )
                    }
                    Button(
                        onClick = { navController.navigate(BirdScreens.BirdDex.name) }, //this button needs to go to the field journal screen
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.fieldnotesbutton),
                            contentDescription = "Field Journal"
                        )
                    }
                }
            }
        }
    ) { innerPadding -> // Content padding to avoid overlap with bottom bar

        NavHost(
            navController = navController,
            startDestination = BirdScreens.FieldJournal.name,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ){
            composable(route = BirdScreens.FieldJournal.name){
                FieldJournal(navController, viewModel)
            }
            composable(route = BirdScreens.NewSighting.name){
                NewSighting(viewModel)
            }
            composable(route = BirdScreens.BirdDex.name){
                BirdDex(viewModel)
            }
        }

    }
}


@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    PocketBirdsMVPTheme {
    }
}