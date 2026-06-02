package com.aura.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

// Color Constants for themes
val AuraCyan = Color(0xFF00F0FF)
val IshqaPink = Color(0xFFFF2D7B)
val GlassBg = Color(0x22FFFFFF)
val GlassBorder = Color(0x33FFFFFF)
val DarkNavy = Color(0xFF080C14)
val DarkPurple = Color(0xFF150512)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen() {
    var isIshqaMode by remember { mutableStateOf(false) }
    var assistantState by remember { mutableStateOf("idle") } // "idle", "listening", "speaking"
    var showPermissionDialog by remember { mutableStateOf(false) }
    var pendingActionText by remember { mutableStateOf("") }
    
    val notesList = remember { mutableStateListOf("Complete project submission", "Check weather update") }
    
    // Animate background colors based on active mode
    val activeBgColor by animateColorAsState(
        targetValue = if (isIshqaMode) DarkPurple else DarkNavy,
        animationSpec = tween(durationMillis = 600), label = "bgColor"
    )
    val activeThemeColor by animateColorAsState(
        targetValue = if (isIshqaMode) IshqaPink else AuraCyan,
        animationSpec = tween(durationMillis = 600), label = "themeColor"
    )

    // Pulsing animation for the main Orb
    val infiniteTransition = rememberInfiniteTransition(label = "orbPulse")
    val orbScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = if (assistantState == "listening") 1.25f else 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "scale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(activeBgColor)
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // 1. APP HEADER
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(GlassBg)
                    .border(1.dp, GlassBorder, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (isIshqaMode) Icons.Default.Favorite else Icons.Default.Star,
                        contentDescription = "Logo",
                        tint = activeThemeColor,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "AURA",
                        color = Color.White,
                        fontSize = 24.sp,
                        style = MaterialTheme.typography.headlineMedium
                    )
                }

                // Mode Toggle
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (isIshqaMode) "ISHQA Mode" else "Pro Mode",
                        color = activeThemeColor,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Switch(
                        checked = isIshqaMode,
                        onCheckedChange = { 
                            isIshqaMode = it 
                            assistantState = "idle"
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = IshqaPink,
                            checkedTrackColor = IshqaPink.copy(alpha = 0.4f),
                            uncheckedThumbColor = AuraCyan,
                            uncheckedTrackColor = AuraCyan.copy(alpha = 0.4f)
                        )
                    )
                }
            }

            // 2. CENTRAL ORB TRIGGER & SINE WAVE AREA
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                // Interactive Orb
                Box(
                    modifier = Modifier
                        .size(150.dp)
                        .scale(orbScale)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(activeThemeColor, activeThemeColor.copy(alpha = 0.3f))
                            )
                        )
                        .clickable {
                            if (assistantState == "listening") {
                                assistantState = "idle"
                            } else {
                                assistantState = "listening"
                                // Mock command interceptor check in ISHQA mode
                                if (isIshqaMode) {
                                    pendingActionText = "Access Geolocation Weather API"
                                    showPermissionDialog = true
                                }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (assistantState == "listening") Icons.Default.PlayArrow else Icons.Default.MailOutline,
                        contentDescription = "Trigger button",
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )
                }
            }

            // 3. DASHBOARD WIDGETS (Notes List)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(GlassBg)
                    .border(1.dp, GlassBorder, RoundedCornerShape(20.dp))
                    .padding(16.dp)
            ) {
                Text(
                    text = "Quick Notes / Reminders",
                    color = Color.White,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                LazyColumn(modifier = Modifier.height(100.dp)) {
                    items(notesList) { note ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "• $note", color = Color.LightGray, fontSize = 13.sp)
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Delete note",
                                tint = Color.Red,
                                modifier = Modifier
                                    .size(16.dp)
                                    .clickable { notesList.remove(note) }
                            )
                        }
                    }
                }
            }
        }

        // 4. ZERO-TRUST PERMISSION DIALOG (ISHQA MODE SHIELD)
        if (showPermissionDialog) {
            PermissionDialog(
                actionName = pendingActionText,
                onDismiss = { 
                    showPermissionDialog = false 
                    assistantState = "idle"
                },
                onConfirm = {
                    showPermissionDialog = false
                    assistantState = "speaking"
                    notesList.add("Geo Weather updated successfully.")
                }
            )
        }
    }
}

@Composable
fun PermissionDialog(
    actionName: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .border(2.dp, IshqaPink, RoundedCornerShape(20.dp)),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = DarkPurple)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Permission heart lock",
                    tint = IshqaPink,
                    modifier = Modifier.size(52.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Approval Required",
                    color = Color.White,
                    fontSize = 20.sp,
                    style = MaterialTheme.typography.titleLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Ishqa is asking to execute a system operation:",
                    color = Color.LightGray,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                        .padding(12.dp)
                ) {
                    Text(text = actionName, color = Color.White, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(24.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)
                    ) {
                        Text("Deny", color = Color.White)
                    }
                    Button(
                        onClick = onConfirm,
                        colors = ButtonDefaults.buttonColors(containerColor = IshqaPink)
                    ) {
                        Text("Allow Action", color = Color.White)
                    }
                }
            }
        }
    }
}
