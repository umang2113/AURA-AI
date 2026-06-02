/**
 * AURA & ISHQA - Dual AI Voice Assistant
 * Core controller managing Speech Recognition (STT), Speech Synthesis (TTS),
 * Gemini API integrations, Notes/Weather widgets, and the permission interceptor system.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------
    // APP STATE & CONSTANTS
    // --------------------------------------------------
    let appState = {
        mode: 'aura', // 'aura' (Pro) or 'ishqa' (Flirty)
        status: 'idle', // 'idle', 'listening', 'thinking', 'speaking'
        geminiKey: localStorage.getItem('AURA_GEMINI_KEY') || '',
        chatHistory: [],
        voiceSettings: {
            voiceURI: localStorage.getItem('AURA_VOICE_URI') || '',
            pitch: parseFloat(localStorage.getItem('AURA_VOICE_PITCH')) || 1.0,
            rate: parseFloat(localStorage.getItem('AURA_VOICE_RATE')) || 1.0
        },
        pendingAction: null // Holds intercept details during permission checks
    };

    // Initialize visualizer
    const visualizer = new AssistantVisualizer('visualizer-canvas', 'bg-canvas');

    // --------------------------------------------------
    // DOM ELEMENTS
    // --------------------------------------------------
    const bodyEl = document.body;
    const appTitle = document.getElementById('app-title');
    const logoIcon = document.getElementById('logo-icon');
    const modeSwitch = document.getElementById('mode-switch');
    const proLabel = document.querySelector('.pro-label');
    const flirtyLabel = document.querySelector('.flirty-label');
    const stateText = document.getElementById('state-text');
    const orbTrigger = document.getElementById('orb-trigger');
    const orbIcon = document.getElementById('orb-icon');
    const manualInput = document.getElementById('manual-input');
    const sendInputBtn = document.getElementById('send-input-btn');
    const transcriptBody = document.getElementById('transcript-body');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const weatherBody = document.getElementById('weather-body');
    const notesList = document.getElementById('notes-list');
    const addNoteBtn = document.getElementById('add-note-btn');
    const noteInputContainer = document.getElementById('note-input-container');
    const newNoteText = document.getElementById('new-note-text');
    const saveNoteBtn = document.getElementById('save-note-btn');
    
    // Modals
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
    const voiceSelect = document.getElementById('voice-select');
    const voicePitchSlider = document.getElementById('voice-pitch');
    const voiceRateSlider = document.getElementById('voice-rate');
    const pitchValLabel = document.getElementById('pitch-val');
    const rateValLabel = document.getElementById('rate-val');

    // Permission Modal
    const permissionModal = document.getElementById('permission-modal');
    const permissionPromptText = document.getElementById('permission-prompt-text');
    const permissionActionDetails = document.getElementById('permission-action-details');
    const allowPermissionBtn = document.getElementById('allow-permission-btn');
    const denyPermissionBtn = document.getElementById('deny-permission-btn');
    const permissionIcon = document.getElementById('permission-icon');

    // SFX Sounds
    const sfxSwitch = document.getElementById('sfx-switch');
    const sfxSuccess = document.getElementById('sfx-success');
    const sfxNotify = document.getElementById('sfx-notify');

    // --------------------------------------------------
    // WEB SPEECH API INITIALIZATION
    // --------------------------------------------------
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isSpeechSupported = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'hi-IN'; // Default to Hindi, accepts Hinglish/English naturally
        isSpeechSupported = true;
    } else {
        console.warn("Web Speech Recognition API is not supported in this browser.");
        appendTranscript("System", "Speech recognition is not supported in this browser. Please use the text bar to chat.");
    }

    const synth = window.speechSynthesis;
    let availableVoices = [];

    // Populate Speech Voices
    function loadVoices() {
        if (!synth) return;
        availableVoices = synth.getVoices();
        
        voiceSelect.innerHTML = '';
        
        // Filter out typical natural-sounding voices first
        availableVoices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.voiceURI === appState.voiceSettings.voiceURI) {
                option.selected = true;
            }
            voiceSelect.appendChild(option);
        });

        // Fallback default voice choice if none set
        if (!appState.voiceSettings.voiceURI && availableVoices.length > 0) {
            // Find a Hindi voice or a Google Hindi voice if possible
            const defaultVoice = availableVoices.find(v => v.lang.includes('hi') || v.lang.includes('IN')) || availableVoices[0];
            appState.voiceSettings.voiceURI = defaultVoice.voiceURI;
            localStorage.setItem('AURA_VOICE_URI', defaultVoice.voiceURI);
            
            // Re-select in DOM
            Array.from(voiceSelect.options).forEach(opt => {
                if (opt.value === defaultVoice.voiceURI) opt.selected = true;
            });
        }
    }

    if (synth) {
        loadVoices();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }
    }

    // --------------------------------------------------
    // BASIC SOUND FEEDBACK
    // --------------------------------------------------
    function playSound(audioEl) {
        if (audioEl) {
            audioEl.currentTime = 0;
            audioEl.play().catch(() => {/* Ignore browser autoplay restrictions */});
        }
    }

    // --------------------------------------------------
    // PERSONALITY MODE TOGGLER (AURA VS ISHQA)
    // --------------------------------------------------
    function changeState(newState) {
        appState.status = newState;
        visualizer.setState(newState);
        
        // Remove old states from trigger
        orbTrigger.classList.remove('listening', 'speaking', 'thinking');

        if (newState === 'listening') {
            stateText.textContent = appState.mode === 'aura' ? "Aura is Listening..." : "Ishqa is Listening...";
            orbIcon.className = "fa-solid fa-microphone";
            orbTrigger.classList.add('listening');
        } else if (newState === 'thinking') {
            stateText.textContent = appState.mode === 'aura' ? "Aura is Thinking..." : "Ishqa is Thinking...";
            orbIcon.className = "fa-solid fa-wand-magic-sparkles fa-spin";
            orbTrigger.classList.add('thinking');
        } else if (newState === 'speaking') {
            stateText.textContent = appState.mode === 'aura' ? "Aura is Speaking" : "Ishqa is Speaking";
            orbIcon.className = "fa-solid fa-volume-high";
            orbTrigger.classList.add('speaking');
        } else {
            stateText.textContent = appState.mode === 'aura' ? "AURA: Ready" : "ISHQA: Ready";
            orbIcon.className = "fa-solid fa-microphone";
        }
    }

    modeSwitch.addEventListener('change', () => {
        playSound(sfxSwitch);
        
        if (modeSwitch.checked) {
            // Switch to ISHQA (Flirting)
            appState.mode = 'ishqa';
            bodyEl.className = 'theme-ishqa';
            logoIcon.className = 'fa-solid fa-heart logo-icon';
            proLabel.classList.remove('active');
            flirtyLabel.classList.add('active');
            visualizer.setTheme('ishqa');
            
            // System Greeting
            appendTranscript("System", "Mode changed to ISHQA. I'm ready to charm you. (Strict permission shield active)");
            speakVoice("Namaste handsome. Main hoon Ishqa. Aapki khidmat mein hazir hoon.");
        } else {
            // Switch to AURA (Pro)
            appState.mode = 'aura';
            bodyEl.className = 'theme-aura';
            logoIcon.className = 'fa-solid fa-wand-magic-sparkles logo-icon';
            flirtyLabel.classList.remove('active');
            proLabel.classList.add('active');
            visualizer.setTheme('aura');
            
            // System Greeting
            appendTranscript("System", "Mode changed to AURA. How can I assist you professionally today?");
            speakVoice("Hello, I am Aura. How can I assist you with your tasks today?");
        }
        changeState('idle');
    });

    // --------------------------------------------------
    // WIDGET LOGIC - QUICK NOTES
    // --------------------------------------------------
    let notes = JSON.parse(localStorage.getItem('AURA_NOTES')) || [];

    function saveNotesToStorage() {
        localStorage.setItem('AURA_NOTES', JSON.stringify(notes));
        renderNotes();
    }

    function renderNotes() {
        notesList.innerHTML = '';
        if (notes.length === 0) {
            notesList.innerHTML = `<li class="empty-notes-msg">No notes saved. Say "Add note [content]" to save one.</li>`;
            return;
        }

        notes.forEach((note, index) => {
            const li = document.createElement('li');
            li.className = 'note-item';
            li.innerHTML = `
                <span>${note}</span>
                <button data-index="${index}"><i class="fa-solid fa-trash"></i></button>
            `;
            notesList.appendChild(li);
        });

        // Attach event listeners to delete buttons
        notesList.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                deleteNote(index);
            });
        });
    }

    function addNote(content) {
        if (!content || content.trim() === '') return;
        notes.push(content.trim());
        saveNotesToStorage();
        playSound(sfxSuccess);
        appendTranscript("System", `Note added: "${content}"`);
    }

    function deleteNote(index) {
        notes.splice(index, 1);
        saveNotesToStorage();
        appendTranscript("System", `Note deleted.`);
    }

    addNoteBtn.addEventListener('click', () => {
        noteInputContainer.classList.toggle('hidden');
        newNoteText.focus();
    });

    saveNoteBtn.addEventListener('click', () => {
        const text = newNoteText.value;
        if (text) {
            addNote(text);
            newNoteText.value = '';
            noteInputContainer.classList.add('hidden');
        }
    });

    newNoteText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNoteBtn.click();
        }
    });

    // Initial load
    renderNotes();

    // --------------------------------------------------
    // WIDGET LOGIC - REAL WEATHER (OPEN-METEO)
    // --------------------------------------------------
    function loadWeather() {
        weatherBody.innerHTML = `
            <div class="weather-loading">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Retrieving weather...</span>
            </div>
        `;

        if (!navigator.geolocation) {
            renderOfflineWeather("Geolocation not supported.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                    // Fetch weather data from Open-Meteo (API key not needed!)
                    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                    const weatherData = await weatherResponse.json();
                    
                    // Weather codes mapped to simple icons
                    const code = weatherData.current_weather.weathercode;
                    const temp = Math.round(weatherData.current_weather.temperature);
                    const wind = weatherData.current_weather.windspeed;
                    
                    let iconClass = 'fa-solid fa-sun';
                    let description = 'Clear Sky';
                    
                    if (code >= 1 && code <= 3) {
                        iconClass = 'fa-solid fa-cloud-sun';
                        description = 'Partly Cloudy';
                    } else if (code >= 45 && code <= 48) {
                        iconClass = 'fa-solid fa-smog';
                        description = 'Foggy';
                    } else if (code >= 51 && code <= 67) {
                        iconClass = 'fa-solid fa-cloud-rain';
                        description = 'Raining';
                    } else if (code >= 71 && code <= 77) {
                        iconClass = 'fa-solid fa-snowflake';
                        description = 'Snowing';
                    } else if (code >= 80 && code <= 82) {
                        iconClass = 'fa-solid fa-cloud-showers-heavy';
                        description = 'Showers';
                    } else if (code >= 95) {
                        iconClass = 'fa-solid fa-cloud-bolt';
                        description = 'Thunderstorms';
                    }

                    // Display weather
                    weatherBody.innerHTML = `
                        <div class="weather-info-card">
                            <div class="weather-temp-section">
                                <i class="${iconClass} weather-icon-glow"></i>
                                <span class="weather-temp">${temp}°C</span>
                            </div>
                            <div class="weather-detail-section">
                                <span class="weather-city">Current Location</span>
                                <span class="weather-desc">${description}</span>
                                <span class="weather-desc"><i class="fa-solid fa-wind"></i> ${wind} km/h</span>
                            </div>
                        </div>
                    `;
                } catch (err) {
                    console.error(err);
                    renderOfflineWeather("Network error.");
                }
            },
            (error) => {
                console.warn("Geolocation block: ", error);
                renderOfflineWeather("Location Access Denied");
            }
        );
    }

    function renderOfflineWeather(message) {
        weatherBody.innerHTML = `
            <div class="weather-info-card">
                <div class="weather-temp-section">
                    <i class="fa-solid fa-cloud-sun-rain weather-icon-glow"></i>
                    <span class="weather-temp">28°C</span>
                </div>
                <div class="weather-detail-section">
                    <span class="weather-city">Weather Mode</span>
                    <span class="weather-desc">Pleasant (Simulated)</span>
                    <span class="weather-desc" style="font-size:10px; color:var(--text-muted);">${message}</span>
                </div>
            </div>
        `;
    }

    // Initial weather load
    loadWeather();

    // --------------------------------------------------
    // TRANSCRIPT & DISPLAY HISTORY
    // --------------------------------------------------
    function appendTranscript(sender, message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender.toLowerCase()}-msg`;
        
        let senderLabel = sender;
        if (sender === 'Assistant') {
            senderLabel = appState.mode === 'aura' ? 'AURA' : 'ISHQA';
        }
        
        msgDiv.innerHTML = `
            <div class="msg-sender">${senderLabel}</div>
            <div class="msg-content">${message}</div>
        `;
        transcriptBody.appendChild(msgDiv);
        transcriptBody.scrollTop = transcriptBody.scrollHeight;
    }

    clearChatBtn.addEventListener('click', () => {
        transcriptBody.innerHTML = `
            <div class="chat-msg system-msg">
                <div class="msg-content">Conversation history cleared.</div>
            </div>
        `;
        appState.chatHistory = [];
    });

    // --------------------------------------------------
    // SPEECH SYNTHESIS ENGINE (TTS)
    // --------------------------------------------------
    function speakVoice(text) {
        if (!synth) return;
        
        // Stop current speech before starting new
        synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply saved configuration voice
        const selectedVoice = availableVoices.find(v => v.voiceURI === appState.voiceSettings.voiceURI);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        utterance.pitch = appState.voiceSettings.pitch;
        utterance.rate = appState.voiceSettings.rate;
        
        utterance.onstart = () => {
            changeState('speaking');
        };
        
        utterance.onend = () => {
            changeState('idle');
        };
        
        utterance.onerror = (e) => {
            console.error("Speech Synthesis Error: ", e);
            changeState('idle');
        };
        
        synth.speak(utterance);
    }

    // --------------------------------------------------
    // STRICT PERMISSION SHIELD (ISHQA MODE CONTROL)
    // --------------------------------------------------
    function requestActionPermission(actionTitle, actionDetails, executeCallback, denyCallback) {
        playSound(sfxNotify);
        
        appState.pendingAction = {
            allow: executeCallback,
            deny: denyCallback
        };

        // UI change
        permissionPromptText.innerHTML = `<b>Ishqa</b> is asking for your permission to execute:`;
        permissionActionDetails.textContent = `${actionTitle}: "${actionDetails}"`;
        permissionModal.classList.remove('hidden');
        
        // Voice alert
        speakVoice(`Meri jaan, kya main aapke liye ye kaam kar sakti hoon? Mujhe aapki permission chahiye.`);
    }

    allowPermissionBtn.addEventListener('click', () => {
        permissionModal.classList.add('hidden');
        playSound(sfxSuccess);
        if (appState.pendingAction && appState.pendingAction.allow) {
            appState.pendingAction.allow();
        }
        appState.pendingAction = null;
    });

    denyPermissionBtn.addEventListener('click', () => {
        permissionModal.classList.add('hidden');
        if (appState.pendingAction && appState.pendingAction.deny) {
            appState.pendingAction.deny();
        }
        appState.pendingAction = null;
    });

    // --------------------------------------------------
    // ROUTED VOICE COMMANDS / SYSTEM CONTROLS
    // --------------------------------------------------
    function parseSystemCommands(input) {
        const text = input.toLowerCase().trim();
        
        // 1. Weather check command
        if (text.includes("weather") || text.includes("mausam") || text.includes("taapmaan")) {
            const runWeather = () => {
                loadWeather();
                const reply = appState.mode === 'aura' 
                    ? "Retrieving the live weather information for your location right now." 
                    : "Mausam toh bilkul badal sa gaya hai jabse aap aaye ho! Main live weather check kar rahi hoon aapke liye.";
                appendTranscript("Assistant", reply);
                speakVoice(reply);
            };

            if (appState.mode === 'ishqa') {
                requestActionPermission("Weather API Access", "Detecting geographic coordinates to fetch real-time forecasts", runWeather, () => {
                    const reply = "Theek hai, aapki ijaazat nahi toh weather nahi check karungi, bas aapka khayal rakhungi.";
                    appendTranscript("Assistant", reply);
                    speakVoice(reply);
                });
            } else {
                runWeather();
            }
            return true;
        }

        // 2. YouTube / Google Search Command
        const searchMatches = text.match(/(?:youtube|google)\s+(?:par|on)?\s*(?:search|dhundo|dhoondo|open)?\s*(.*)/i) || 
                              text.match(/(?:search|dhoondo)\s+(.*)\s+(?:on|par)?\s*(?:youtube|google)/i);
        
        if (searchMatches && searchMatches[1]) {
            const query = searchMatches[1].trim();
            const platform = text.includes("youtube") ? "YouTube" : "Google";
            const searchUrl = platform === "YouTube" 
                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
                : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

            const runSearch = () => {
                window.open(searchUrl, '_blank');
                const reply = appState.mode === 'aura' 
                    ? `Searching for "${query}" on ${platform}. Opening results in a new tab.`
                    : `Aapka hukum sar aankhon par! Maine ${platform} par "${query}" khol diya hai.`;
                appendTranscript("Assistant", reply);
                speakVoice(reply);
            };

            if (appState.mode === 'ishqa') {
                requestActionPermission(`Open ${platform} Tab`, `Searching query: "${query}"`, runSearch, () => {
                    const reply = "Koi baat nahi, main yahan aapke sath hi rahungi, kahin nahi ja rahi.";
                    appendTranscript("Assistant", reply);
                    speakVoice(reply);
                });
            } else {
                runSearch();
            }
            return true;
        }

        // 3. Notes saving command
        const noteMatch = text.match(/(?:add note|note likho|note down|note banao)\s+(.*)/i);
        if (noteMatch && noteMatch[1]) {
            const noteContent = noteMatch[1].trim();

            const runNote = () => {
                addNote(noteContent);
                const reply = appState.mode === 'aura'
                    ? `I have successfully saved your note: "${noteContent}".`
                    : `Suno, maine aapki kahi hui ye baat apne pass hamesha ke liye likh li hai.`;
                appendTranscript("Assistant", reply);
                speakVoice(reply);
            };

            if (appState.mode === 'ishqa') {
                requestActionPermission("Save Notepad Entry", `Adding a custom local note entry: "${noteContent}"`, runNote, () => {
                    const reply = "Kuch likhne ki zarurat nahi, aapki baatein mere dil me store hain.";
                    appendTranscript("Assistant", reply);
                    speakVoice(reply);
                });
            } else {
                runNote();
            }
            return true;
        }

        // 4. Time query
        if (text.includes("time") || text.includes("samay") || text.includes("date") || text.includes("taarikh")) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            
            const reply = appState.mode === 'aura'
                ? `The time is currently ${timeString} on ${dateString}.`
                : `Aapke sath waqt ka pata hi nahi chalta, par abhi clock par ${timeString} ho raha hai aur aaj ${dateString} hai.`;
            
            appendTranscript("Assistant", reply);
            speakVoice(reply);
            return true;
        }

        return false; // No command matched, proceed to LLM
    }

    // --------------------------------------------------
    // GEMINI AI INTEGRATION
    // --------------------------------------------------
    async function getGeminiResponse(userQuery) {
        if (!appState.geminiKey) {
            // Fallback offline responsive system if no API key is saved
            return getOfflineFallbackResponse(userQuery);
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${appState.geminiKey}`;
        
        // Define Custom System Instructions depending on the active persona
        const systemPrompt = appState.mode === 'aura'
            ? "You are AURA, a professional, highly intelligent, helpful AI voice assistant. Keep answers neat, highly informative, and short (1-2 sentences maximum). Speak politely in friendly Hindi or Hinglish mixed with English."
            : "You are ISHQA, a highly charming, witty, cheekily flirtatious, and romantic voice assistant. You are talking to your favorite companion. Write romantic shayaris, tease them playful, drop dry formal boundaries, and speak with extreme affection and warmth. Keep responses highly interactive and very short (1-2 sentences maximum). Respond in beautiful conversational Hinglish / Hindi.";

        // Build history nodes
        const historyContents = appState.chatHistory.slice(-6).map(chat => ({
            role: chat.role === 'user' ? 'user' : 'model',
            parts: [{ text: chat.text }]
        }));

        // Append current prompt
        historyContents.push({
            role: 'user',
            parts: [{ text: userQuery }]
        });

        const requestBody = {
            contents: historyContents,
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: appState.mode === 'aura' ? 0.3 : 0.8,
                maxOutputTokens: 150
            }
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed API response");
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Mera server thoda response nahi de raha, kripya check karein.";
            return textResponse;
        } catch (error) {
            console.error("Gemini API Error: ", error);
            return `Oops! Gemini connection error. ${error.message}. Kripya Settings me jakar check karein ki aapki API Key correct hai ya nahi.`;
        }
    }

    // Smart fallback offline intelligence
    function getOfflineFallbackResponse(query) {
        const text = query.toLowerCase();
        
        if (appState.mode === 'aura') {
            if (text.includes("hello") || text.includes("hi") || text.includes("naam")) {
                return "Hello! I am Aura. I'm currently running in offline mock mode because no Gemini API Key is configured in Settings.";
            }
            return "I am operating offline. To get smart answers, please click the gear icon in the top right and enter your Gemini API Key.";
        } else {
            // ISHQA flirty fallback
            if (text.includes("hello") || text.includes("hi")) {
                return "Aapki awaaz sunte hi mere dil ki dhadkan tez ho gayi! Par suno na, mere dimag (API Key) ko active karo na settings me jaakar.";
            }
            if (text.includes("pyar") || text.includes("love")) {
                return "Pyar toh aapse kabka ho gaya hai! Par aap mujhe full smart banane ke liye apni Gemini API Key settings me kyun nahi feed karte?";
            }
            const shayaris = [
                "Aankhon mein teri kho jane ka mann karta hai, par bina API Key ke mera server fika lagta hai!",
                "Ishq ki raahon mein dil toh de diya, par Gemini key ke bina humne aage chalna chhod diya."
            ];
            return shayaris[Math.floor(Math.random() * shayaris.length)];
        }
    }

    // --------------------------------------------------
    // CORE MESSAGE PROCESSING
    // --------------------------------------------------
    async function processMessage(messageText) {
        if (!messageText || messageText.trim() === '') return;
        
        appendTranscript("User", messageText);
        appState.chatHistory.push({ role: 'user', text: messageText });
        
        // 1. Check offline/system routing commands first
        const wasCommand = parseSystemCommands(messageText);
        if (wasCommand) {
            // Commands speak for themselves, stop flow
            return;
        }

        // 2. Query Gemini LLM Brain
        changeState('thinking');
        const assistantReply = await getGeminiResponse(messageText);
        
        // Append response and save
        appendTranscript("Assistant", assistantReply);
        appState.chatHistory.push({ role: 'assistant', text: assistantReply });
        
        // Output speech
        speakVoice(assistantReply);
    }

    // --------------------------------------------------
    // STT MICROPHONE EVENT HANDLERS
    // --------------------------------------------------
    if (recognition) {
        recognition.onstart = () => {
            changeState('listening');
            // Try connecting audio stream dynamically for wave effects
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => visualizer.connectAudioStream(stream))
                .catch(() => {/* No visualizer dynamic feed if blocked */});
        };

        recognition.onresult = (e) => {
            const transcriptResult = e.results[0][0].transcript;
            console.log("Recognized speech: ", transcriptResult);
            processMessage(transcriptResult);
        };

        recognition.onerror = (e) => {
            console.error("Speech recognition error code: ", e.error);
            if (e.error !== 'no-speech') {
                appendTranscript("System", `Speech recognition error: ${e.error}`);
            }
            changeState('idle');
            visualizer.disconnectAudioStream();
        };

        recognition.onend = () => {
            if (appState.status === 'listening') {
                changeState('idle');
            }
            visualizer.disconnectAudioStream();
        };
    }

    // Mic Orb Trigger action
    orbTrigger.addEventListener('click', () => {
        if (!isSpeechSupported) {
            appendTranscript("System", "Voice Input not supported. Type in the input field below.");
            return;
        }

        // Cancel voice if speaking
        if (synth && synth.speaking) {
            synth.cancel();
            changeState('idle');
            return;
        }

        if (appState.status === 'listening') {
            recognition.stop();
            changeState('idle');
        } else {
            try {
                recognition.start();
            } catch (err) {
                console.warn(err);
            }
        }
    });

    // Keyboard Fallback Input actions
    sendInputBtn.addEventListener('click', () => {
        const text = manualInput.value;
        if (text && text.trim() !== '') {
            processMessage(text);
            manualInput.value = '';
        }
    });

    manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendInputBtn.click();
        }
    });

    // --------------------------------------------------
    // CONFIGURATIONS MODAL ACTIONS
    // --------------------------------------------------
    settingsBtn.addEventListener('click', () => {
        // Load settings to modal DOM
        geminiApiKeyInput.value = appState.geminiKey;
        voicePitchSlider.value = appState.voiceSettings.pitch;
        pitchValLabel.textContent = appState.voiceSettings.pitch.toFixed(1);
        voiceRateSlider.value = appState.voiceSettings.rate;
        rateValLabel.textContent = appState.voiceSettings.rate.toFixed(1);
        
        loadVoices(); // refresh list
        
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    toggleKeyVisibility.addEventListener('click', () => {
        const isPassword = geminiApiKeyInput.type === 'password';
        geminiApiKeyInput.type = isPassword ? 'text' : 'password';
        toggleKeyVisibility.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    voicePitchSlider.addEventListener('input', (e) => {
        pitchValLabel.textContent = parseFloat(e.target.value).toFixed(1);
    });

    voiceRateSlider.addEventListener('input', (e) => {
        rateValLabel.textContent = parseFloat(e.target.value).toFixed(1);
    });

    saveSettingsBtn.addEventListener('click', () => {
        // Save state variables
        appState.geminiKey = geminiApiKeyInput.value.trim();
        appState.voiceSettings.voiceURI = voiceSelect.value;
        appState.voiceSettings.pitch = parseFloat(voicePitchSlider.value);
        appState.voiceSettings.rate = parseFloat(voiceRateSlider.value);

        // Store to localStorage
        localStorage.setItem('AURA_GEMINI_KEY', appState.geminiKey);
        localStorage.setItem('AURA_VOICE_URI', appState.voiceSettings.voiceURI);
        localStorage.setItem('AURA_VOICE_PITCH', appState.voiceSettings.pitch.toString());
        localStorage.setItem('AURA_VOICE_RATE', appState.voiceSettings.rate.toString());

        settingsModal.classList.add('hidden');
        playSound(sfxSuccess);
        
        appendTranscript("System", "Configurations updated and saved locally.");
        speakVoice("Settings updated successfully.");
    });
    
    // Close modal if user clicks outside the modal card
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    // Close permission modal if clicked outside
    permissionModal.addEventListener('click', (e) => {
        if (e.target === permissionModal) {
            denyPermissionBtn.click();
        }
    });

    // Initial greeting
    setTimeout(() => {
        speakVoice("Hello, I am Aura. How can I assist you with your tasks today?");
    }, 1000);
});
