/**
 * AURA & ISHQA Voice Assistant - Backend API Service
 * Manages cognitive LLM requests, profile registrations, local DB syncing, and notes tracking.
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing middleware
app.use(cors());
app.use(express.json());

// In-Memory Database Fallback if PostgreSQL is not connected
let memoryProfiles = [
    {
        profile_id: "default-id-12345",
        username: "Umang",
        persona_mode: "Professional",
        voice_pitch: 1.0,
        voice_rate: 1.0,
        voice_embedding: Array(128).fill(0.01) // Mock 128-dimensional float array
    }
];

let memoryNotes = [
    {
        note_id: "note-1",
        profile_id: "default-id-12345",
        content: "Deploy AURA ecosystem to production.",
        created_at: new Date()
    }
];

// Helper to check for default api key (using the one provided by user)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAFIopWHMon0VbXkJxg86ux84ZtvvBl5-k';

// --------------------------------------------------
// ROUTE: SYSTEM HEALTH
// --------------------------------------------------
app.get('/api/health', (req, res) => {
    res.json({
        status: "online",
        service: "AURA API Gateway",
        timestamp: new Date()
    });
});

// --------------------------------------------------
// ROUTE: AI CONVERSATION (AURA PRO & ISHQA DISPATCHER)
// --------------------------------------------------
app.post('/api/chat', async (req, res) => {
    const { message, history, mode, voiceEmbeddings } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message parameter is required" });
    }

    // 1. VOICE BIOMETRICS MATCHING (MiniAI verification simulation)
    // Real world implementation uses Cosine similarity on the embeddings array.
    if (voiceEmbeddings && Array.isArray(voiceEmbeddings)) {
        // Validate user authentication by checking distance with profile vector
        const matchesOwner = true; // Simulating match
        if (!matchesOwner) {
            return res.status(401).json({ error: "Access Denied: Voice verification mismatch (Silent Reject)" });
        }
    }

    // 2. Build Gemini System Prompt based on personality
    const systemPrompt = mode === 'ishqa'
        ? "You are ISHQA, a highly charming, witty, cheekily flirtatious, and romantic voice assistant. You are talking to your favorite companion. Write romantic shayaris, tease them playfully, drop dry formal boundaries, and speak with extreme affection and warmth. Keep responses highly interactive and very short (1-2 sentences maximum). Respond in beautiful conversational Hinglish / Hindi."
        : "You are AURA, a professional, highly intelligent, helpful AI voice assistant. Keep answers neat, highly informative, and short (1-2 sentences maximum). Speak politely in friendly Hindi or Hinglish mixed with English.";

    // 3. Format history for Gemini API
    const formattedHistory = (history || []).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    formattedHistory.push({
        role: 'user',
        parts: [{ text: message }]
    });

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(geminiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: formattedHistory,
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    temperature: mode === 'ishqa' ? 0.85 : 0.3,
                    maxOutputTokens: 150
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.json();
            throw new Error(errBody.error?.message || "Gemini endpoint error");
        }

        const data = await response.json();
        const textReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
        
        res.json({ reply: textReply });
    } catch (err) {
        console.error("LLM Error: ", err);
        res.status(500).json({ error: "Internal AI Engine Error", details: err.message });
    }
});

// --------------------------------------------------
// ROUTE: PROFILE REGISTRATION & BIOMETRICS VECTORS
// --------------------------------------------------
app.post('/api/profiles/register', (req, res) => {
    const { username, persona_mode, voice_embedding } = req.body;
    
    if (!username || !voice_embedding || !Array.isArray(voice_embedding)) {
        return res.status(400).json({ error: "Missing required profile parameters" });
    }

    const newProfile = {
        profile_id: `profile-${Date.now()}`,
        username,
        persona_mode: persona_mode || 'Professional',
        voice_pitch: 1.0,
        voice_rate: 1.0,
        voice_embedding
    };

    memoryProfiles.push(newProfile);
    res.status(201).json({ message: "Voice profile successfully registered", profile: newProfile });
});

app.get('/api/profiles', (req, res) => {
    // Return profiles excluding actual raw embeddings for privacy security
    const sanitized = memoryProfiles.map(p => ({
        profile_id: p.profile_id,
        username: p.username,
        persona_mode: p.persona_mode
    }));
    res.json(sanitized);
});

// --------------------------------------------------
// ROUTE: NOTES MANAGER API
// --------------------------------------------------
app.get('/api/notes/:profileId', (req, res) => {
    const profileId = req.params.profileId;
    const notes = memoryNotes.filter(n => n.profile_id === profileId);
    res.json(notes);
});

app.post('/api/notes', (req, res) => {
    const { profile_id, content } = req.body;
    
    if (!profile_id || !content) {
        return res.status(400).json({ error: "Missing note profile_id or content" });
    }

    const newNote = {
        note_id: `note-${Date.now()}`,
        profile_id,
        content,
        created_at: new Date()
    };

    memoryNotes.push(newNote);
    res.status(201).json(newNote);
});

app.delete('/api/notes/:noteId', (req, res) => {
    const noteId = req.params.noteId;
    const index = memoryNotes.findIndex(n => n.note_id === noteId);
    
    if (index === -1) {
        return res.status(404).json({ error: "Note not found" });
    }

    memoryNotes.splice(index, 1);
    res.json({ message: "Note deleted successfully" });
});

// --------------------------------------------------
// ROUTE: GEOLOCATION WEATHER PROXY
// --------------------------------------------------
app.get('/api/weather', async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Latitude and Longitude query parameters required" });
    }

    try {
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const weatherData = await weatherResponse.json();
        res.json(weatherData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Weather API Forwarding failure" });
    }
});

// Start Server listener
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`AURA Ecosystem Backend running on port ${PORT}`);
    console.log(`Default Gemini key: Enabled`);
    console.log(`==================================================`);
});
