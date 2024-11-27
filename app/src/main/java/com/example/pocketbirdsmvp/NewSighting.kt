package com.example.pocketbirdsmvp

import android.app.DatePickerDialog
import android.widget.DatePicker
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Error
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import android.content.Context

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewSighting(viewModel: BirdViewModel) {
    var birdName by remember { mutableStateOf("") }
    var isExpanded by remember { mutableStateOf(false) }
    var selectedDate by remember { mutableStateOf(Date()) }
    var location by remember { mutableStateOf("") } // New state for location
    var isNameError by remember { mutableStateOf(false) }
    var showSuccessSnackbar by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val keyboardController = LocalSoftwareKeyboardController.current

    // List of North American birds (you would replace this with your full 2000-bird list)
    val northAmericanBirds = loadBirdNames(context)

    // Filtered list of birds based on input with improved matching
    val filteredBirds = remember(birdName) {
        if (birdName.isBlank()) {
            emptyList()
        } else {
            northAmericanBirds
                .filter { bird ->
                    // Prioritize starts-with match first
                    bird.startsWith(birdName, ignoreCase = true) ||
                            bird.contains(birdName, ignoreCase = true)
                }
                .sortedWith(
                    compareBy(
                        // Prioritize matches that start with the input
                        { !it.startsWith(birdName, ignoreCase = true) },
                        // Then sort by how close the match is
                        { it.lowercase().indexOf(birdName.lowercase()) }
                    )
                )
                .take(5) // Limit to 5 results
        }
    }

    val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val calendar = Calendar.getInstance()
    val datePickerDialog = DatePickerDialog(
        context,
        { _: DatePicker, year: Int, month: Int, dayOfMonth: Int ->
            calendar.set(year, month, dayOfMonth)
            selectedDate = calendar.time
        },
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH),
        calendar.get(Calendar.DAY_OF_MONTH)
    )

    Scaffold(
        containerColor = Color.Black,
        contentColor = Color.White,
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = Color.DarkGray,
                    contentColor = Color.White
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .padding(innerPadding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Bird Name Input with Autocomplete
            ExposedDropdownMenuBox(
                expanded = isExpanded && filteredBirds.isNotEmpty(),
                onExpandedChange = {
                    isExpanded = filteredBirds.isNotEmpty()
                }
            ) {
                TextField(
                    value = birdName,
                    onValueChange = {
                        birdName = it
                        isExpanded = true
                        isNameError = it.isBlank()
                    },
                    label = { Text("Bird Name", color = Color.White) },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(
                            expanded = isExpanded && filteredBirds.isNotEmpty()
                        )
                    },
                    colors = TextFieldDefaults.colors(
                        cursorColor = Color.White,
                        focusedContainerColor = Color.DarkGray,
                        unfocusedContainerColor = Color.DarkGray,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedLabelColor = Color.White,
                        unfocusedLabelColor = Color.White
                    ),
                    isError = isNameError,
                    supportingText = {
                        if (isNameError) {
                            Text(
                                text = "Bird name cannot be blank",
                                color = Color.Red
                            )
                        }
                    },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )

                // Dropdown Menu for Suggestions
                if (filteredBirds.isNotEmpty()) {
                    ExposedDropdownMenu(
                        expanded = isExpanded,
                        onDismissRequest = { isExpanded = false },
                        modifier = Modifier.background(Color.DarkGray)
                    ) {
                        filteredBirds.forEach { bird ->
                            DropdownMenuItem(
                                text = { Text(bird) },
                                onClick = {
                                    birdName = bird
                                    isExpanded = false
                                    isNameError = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Date Input
            TextField(
                value = dateFormatter.format(selectedDate),
                onValueChange = { /* Not editable directly */ },
                readOnly = true,
                label = { Text("Date", color = Color.White) },
                trailingIcon = {
                    IconButton(
                        onClick = { datePickerDialog.show() }
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CalendarToday,
                            contentDescription = "Select Date",
                            tint = Color.White
                        )
                    }
                },
                colors = TextFieldDefaults.colors(
                    cursorColor = Color.White,
                    focusedContainerColor = Color.DarkGray,
                    unfocusedContainerColor = Color.DarkGray,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedLabelColor = Color.White,
                    unfocusedLabelColor = Color.Gray
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // New Location Input
            TextField(
                value = location,
                onValueChange = { location = it },
                label = { Text("Location (Optional)", color = Color.White) },
                colors = TextFieldDefaults.colors(
                    cursorColor = Color.White,
                    focusedContainerColor = Color.DarkGray,
                    unfocusedContainerColor = Color.DarkGray,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedLabelColor = Color.White,
                    unfocusedLabelColor = Color.Gray
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Submit Button
            Button(
                onClick = {
                    if (birdName.isNotBlank()) {
                        keyboardController?.hide()

                        val formattedDate = dateFormatter.format(selectedDate)

                        viewModel.submitSighting(
                            birdName = birdName,
                            date = formattedDate,
                            location = location // Include location in submission
                        )

                        showSuccessSnackbar = true
                        birdName = ""
                        selectedDate = Date()
                        location = "" // Reset location field
                    } else {
                        isNameError = true
                    }
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFFFD700),
                    contentColor = Color.Black,
                    disabledContainerColor = Color.Gray,
                    disabledContentColor = Color.Black
                ),
                enabled = birdName.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Log Sighting")
            }
        }

        LaunchedEffect(showSuccessSnackbar) {
            if (showSuccessSnackbar) {
                snackbarHostState.showSnackbar(
                    message = "Sighting logged successfully!",
                    duration = SnackbarDuration.Short
                )
                showSuccessSnackbar = false
            }
        }
    }
}

fun loadBirdNames(context: Context): List<String> {
    val inputStream = context.assets.open("birdnames.csv")
    return inputStream.bufferedReader().use { it.readLines() }
}
