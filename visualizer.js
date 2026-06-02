/**
 * AURA & ISHQA Voice Assistant - Audio & Particle Visualizer
 * Renders Canvas-based visual animations depending on system states and active themes.
 */

class AssistantVisualizer {
    constructor(canvasId, bgCanvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.bgCanvas = document.getElementById(bgCanvasId);
        this.bgCtx = this.bgCanvas.getContext('2d');
        
        this.state = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'
        this.theme = 'aura';  // 'aura', 'ishqa'
        
        // Sine wave variables
        this.phase = 0;
        this.amplitudeModifier = 1;
        this.frequencyModifier = 1;
        
        // Particle arrays
        this.particles = [];
        this.bgParticles = [];
        
        // Mic audio stream variables
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.isMicActive = false;
        
        this.init();
    }

    init() {
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
        
        // Start background particle system
        this.createBgParticles(30);
        
        // Start animation loop
        this.animate();
    }

    resizeCanvases() {
        // Main visualizer canvas resize
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height || 350;
        
        // Background particles canvas resize
        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;
    }

    setState(newState) {
        this.state = newState;
        if (newState === 'listening') {
            this.amplitudeModifier = 1.8;
            this.frequencyModifier = 1.5;
        } else if (newState === 'thinking') {
            this.amplitudeModifier = 0.5;
            this.frequencyModifier = 3.5;
        } else if (newState === 'speaking') {
            this.amplitudeModifier = 2.2;
            this.frequencyModifier = 0.9;
        } else {
            // Idle
            this.amplitudeModifier = 0.6;
            this.frequencyModifier = 0.8;
        }
    }

    setTheme(newTheme) {
        this.theme = newTheme;
        // Adjust particles when switching themes
        if (newTheme === 'ishqa') {
            this.createHearts(15);
        } else {
            this.particles = [];
        }
    }

    // Connect real audio stream from STT or TTS if available
    connectAudioStream(stream) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.isMicActive = true;
        } catch (e) {
            console.warn("Could not connect audio stream to visualizer: ", e);
            this.isMicActive = false;
        }
    }

    disconnectAudioStream() {
        this.isMicActive = false;
        this.analyser = null;
        this.dataArray = null;
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }

    // CREATE PARTICLES
    createBgParticles(count) {
        this.bgParticles = [];
        for (let i = 0; i < count; i++) {
            this.bgParticles.push({
                x: Math.random() * this.bgCanvas.width,
                y: Math.random() * this.bgCanvas.height,
                size: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: -Math.random() * 0.4 - 0.1,
                opacity: Math.random() * 0.5 + 0.1
            });
        }
    }

    createHearts(count) {
        // Create special heart particles for ISHQA mode visualizer
        for (let i = 0; i < count; i++) {
            this.particles.push(this.newHeart());
        }
    }

    newHeart() {
        return {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height + Math.random() * 50,
            size: Math.random() * 8 + 6,
            speedX: (Math.random() - 0.5) * 1.2,
            speedY: -Math.random() * 1.5 - 0.8,
            opacity: Math.random() * 0.6 + 0.4,
            wiggleSpeed: Math.random() * 0.05 + 0.02,
            wiggleScale: Math.random() * 2 + 1,
            phase: Math.random() * Math.PI * 2
        };
    }

    // DRAW SHAPES
    drawHeart(ctx, x, y, size, opacity) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = `rgba(255, 45, 123, ${opacity})`;
        ctx.beginPath();
        ctx.moveTo(0, -size / 4);
        ctx.bezierCurveTo(-size / 2, -size * 3/4, -size, -size / 3, -size, size / 4);
        ctx.bezierCurveTo(-size, size * 2/3, -size / 3, size, 0, size * 1.2);
        ctx.bezierCurveTo(size / 3, size, size, size * 2/3, size, size / 4);
        ctx.bezierCurveTo(size, -size / 3, size / 2, -size * 3/4, 0, -size / 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    updateAndDrawBgParticles() {
        this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
        
        let color = '#00f0ff'; // aura color
        if (this.theme === 'ishqa') {
            color = '#ff2d7b'; // ishqa color
        }
        
        this.bgCtx.fillStyle = color;
        
        this.bgParticles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            
            // Loop particles
            if (p.y < 0) {
                p.y = this.bgCanvas.height;
                p.x = Math.random() * this.bgCanvas.width;
            }
            if (p.x < 0 || p.x > this.bgCanvas.width) {
                p.speedX *= -1;
            }
            
            this.bgCtx.save();
            this.bgCtx.globalAlpha = p.opacity;
            this.bgCtx.beginPath();
            this.bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.bgCtx.fill();
            this.bgCtx.restore();
        });
    }

    updateAndDrawHearts() {
        if (this.theme !== 'ishqa') return;
        
        this.particles.forEach((p, idx) => {
            p.y += p.speedY;
            p.x += p.speedX + Math.sin(p.phase) * p.wiggleScale;
            p.phase += p.wiggleSpeed;
            p.opacity -= 0.002;
            
            // Draw heart
            this.drawHeart(this.ctx, p.x, p.y, p.size, Math.max(0, p.opacity));
            
            // Recycle heart if it floats off or fades
            if (p.y < -20 || p.opacity <= 0) {
                this.particles[idx] = this.newHeart();
            }
        });
    }

    drawSineWave(color, offset, thickness, ampScale, freqScale) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const midY = height / 2;
        
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        
        // Apply glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        
        let localAmp = 25 * this.amplitudeModifier * ampScale;
        
        // If mic is active, alter amplitude based on average audio frequency
        if (this.isMicActive && this.analyser) {
            this.analyser.getByteFrequencyData(this.dataArray);
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            let average = sum / this.dataArray.length;
            localAmp = (average / 2.5) * ampScale;
            if (this.state === 'idle') localAmp = Math.max(12, localAmp);
        }
        
        for (let x = 0; x < width; x++) {
            // Envelope function to taper waves at boundaries (left and right edges)
            const envelope = Math.sin((x / width) * Math.PI);
            
            const frequency = 0.008 * this.frequencyModifier * freqScale;
            const angle = x * frequency + this.phase + offset;
            
            const y = midY + Math.sin(angle) * localAmp * envelope;
            
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow
    }

    animate() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update background
        this.updateAndDrawBgParticles();
        
        // Update Ishqa heart particles if active
        this.updateAndDrawHearts();
        
        // Define wave colors based on active theme
        let waveColor1, waveColor2, waveColor3;
        
        if (this.theme === 'aura') {
            waveColor1 = 'rgba(0, 240, 255, 0.8)'; // Neon Cyan
            waveColor2 = 'rgba(168, 85, 247, 0.4)'; // Soft Purple
            waveColor3 = 'rgba(56, 189, 248, 0.2)'; // Faded Indigo
        } else {
            // Ishqa Theme
            waveColor1 = 'rgba(255, 45, 123, 0.8)'; // Crimson Pink
            waveColor2 = 'rgba(244, 63, 94, 0.4)';  // Rose Red
            waveColor3 = 'rgba(251, 113, 133, 0.2)'; // Faded Pink
        }
        
        // Render overlapping waves
        this.drawSineWave(waveColor3, Math.PI, 1.5, 0.6, 0.7);
        this.drawSineWave(waveColor2, Math.PI / 2, 2, 0.8, 1.2);
        this.drawSineWave(waveColor1, 0, 3, 1.0, 1.0);
        
        // Update phase rotation
        let phaseSpeed = 0.08;
        if (this.state === 'listening') phaseSpeed = 0.15;
        if (this.state === 'thinking') phaseSpeed = 0.25;
        if (this.state === 'speaking') phaseSpeed = 0.12;
        
        this.phase += phaseSpeed;
        
        // Request next frame
        requestAnimationFrame(() => this.animate());
    }
}
