package com.aura.lite

import android.app.Service
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.IBinder
import android.util.Log
import java.io.File
import kotlin.math.sqrt

/**
 * AURA Lite - Background Audio Service
 * Continuously monitors the mic offline for the wake word "Aura" or "Hey Aura".
 * Performs voice verification biometric matching before waking AURA Pro.
 */
class AuraLiteService : Service() {

    private var isListening = false
    private var recordThread: Thread? = null
    
    // Mock user profile voice embedding (128-dimensional mathematical vector)
    private val ownerVoiceEmbedding = FloatArray(128) { 0.05f }
    private val similarityThreshold = 0.85f // Co-sine similarity acceptance cap

    override fun onCreate() {
        super.onCreate()
        Log.d("AuraLiteService", "AURA Lite background gatekeeper service initialized.")
        startBackgroundListening()
    }

    private fun startBackgroundListening() {
        isListening = true
        recordThread = Thread {
            val bufferSize = AudioRecord.getMinBufferSize(
                16000, 
                AudioFormat.CHANNEL_IN_MONO, 
                AudioFormat.ENCODING_PCM_16BIT
            )
            
            val audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                16000,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )

            if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
                Log.e("AuraLiteService", "AudioRecord initialization failed.")
                return@Thread
            }

            audioRecord.startRecording()
            val audioBuffer = ShortArray(bufferSize)

            while (isListening) {
                val readSize = audioRecord.read(audioBuffer, 0, audioBuffer.size)
                if (readSize > 0) {
                    // 1. OFFLINE WAKE WORD DETECTOR (e.g. Vosk / Porcupine interface)
                    val isWakeWordDetected = detectWakeWordOffline(audioBuffer, readSize)
                    
                    if (isWakeWordDetected) {
                        Log.i("AuraLiteService", "Wake word 'Aura' detected. Triggering voice matching...")
                        
                        // 2. EXTRACT BIOMETRIC VECTOR & VERIFY WRITER
                        val inputEmbedding = extractVoiceEmbedding(audioBuffer, readSize)
                        val matchDistance = calculateCosineSimilarity(inputEmbedding, ownerVoiceEmbedding)
                        
                        if (matchDistance >= similarityThreshold) {
                            Log.i("AuraLiteService", "Voice Verified! Cosine distance: $matchDistance. Launching AURA Pro...")
                            launchAuraProUI()
                        } else {
                            // 3. SILENT REJECT MODE
                            // Mismatch remains silent. Does not play warning sounds or open apps.
                            Log.w("AuraLiteService", "Access Denied: Biometric mismatch ($matchDistance). Ignoring.")
                            
                            // 4. Check for Emergency trigger even if voice validation failed
                            if (checkForEmergencyKeywords(audioBuffer, readSize)) {
                                Log.e("AuraLiteService", "Emergency Keyword detected! Entering Emergency Mode.")
                                triggerEmergencyProtocol()
                            }
                        }
                    }
                }
            }

            audioRecord.stop()
            audioRecord.release()
        }
        recordThread?.start()
    }

    private fun detectWakeWordOffline(buffer: ShortArray, size: Int): Boolean {
        // Real-world: feeds buffer to Vosk or Porcupine C-Library.
        // Mock simulation: check if average volume exceeds a threshold (for trigger simulation)
        return false // Defaults to listener waiting. Real implementation pipes raw bytes.
    }

    private fun extractVoiceEmbedding(buffer: ShortArray, size: Int): FloatArray {
        // Feeds the raw PCM slice to a local ResNet voice extraction ONNX model
        // Returns a 128-dimensional compressed vector representation of the vocal folds
        return FloatArray(128) { 0.05f } 
    }

    private fun calculateCosineSimilarity(vecA: FloatArray, vecB: FloatArray): Float {
        var dotProduct = 0.0f
        var normA = 0.0f
        var normB = 0.0f
        for (i in vecA.indices) {
            dotProduct += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        return if (normA == 0.0f || normB == 0.0f) 0.0f else dotProduct / (sqrt(normA) * sqrt(normB))
    }

    private fun checkForEmergencyKeywords(buffer: ShortArray, size: Int): Boolean {
        // Offline vocabulary scanner scanning for "Emergency", "bachao", "help"
        return false
    }

    private fun triggerEmergencyProtocol() {
        // Emergency code: trigger local device alarm or dial emergency contact directly
        val intent = Intent("com.aura.action.EMERGENCY_TRIGGER")
        sendBroadcast(intent)
    }

    private fun launchAuraProUI() {
        val dialogIntent = Intent(this, Class.forName("com.aura.ui.DashboardActivity"))
        dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(dialogIntent)
    }

    override fun onDestroy() {
        isListening = false
        recordThread?.interrupt()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
