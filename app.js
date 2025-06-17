// QBH-FER System JavaScript Implementation
class QBHFERSystem {
    constructor() {
        this.emotionLabels = ["喜び", "悲しみ", "怒り", "驚き", "恐怖", "嫌悪", "軽蔑", "中立"];
        this.systemData = {
            emotionLabels: ["喜び", "悲しみ", "怒り", "驚き", "恐怖", "嫌悪", "軽蔑", "中立"],
            analysisParameters: {
                brightnessBased: {
                    veryBright: {emotion: "喜び", confidence: 0.9},
                    bright: {emotion: "喜び", confidence: 0.8},
                    moderate: {emotion: "中立", confidence: 0.7},
                    dark: {emotion: "悲しみ", confidence: 0.6}
                },
                contrastBased: {
                    high: {intensity: "強い", modifier: 0.1},
                    medium: {intensity: "中程度", modifier: 0.05},
                    low: {intensity: "穏やか", modifier: 0.0}
                }
            }
        };
        
        this.currentStream = null;
        this.realtimeInterval = null;
        this.frameCount = 0;
        this.confidenceHistory = [];
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // File upload
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');
        
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));

        // Analysis buttons
        document.getElementById('analyze-upload-btn').addEventListener('click', () => this.analyzeUploadedImage());
        document.getElementById('analyze-camera-btn').addEventListener('click', () => this.analyzeCapturedImage());

        // Camera controls
        document.getElementById('start-camera-btn').addEventListener('click', () => this.startCamera('camera'));
        document.getElementById('capture-btn').addEventListener('click', () => this.captureImage());
        document.getElementById('stop-camera-btn').addEventListener('click', () => this.stopCamera('camera'));

        // Realtime controls
        document.getElementById('start-realtime-btn').addEventListener('click', () => this.startRealtimeAnalysis());
        document.getElementById('stop-realtime-btn').addEventListener('click', () => this.stopRealtimeAnalysis());
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Clean up when switching tabs
        this.cleanupActiveStreams();
    }

    cleanupActiveStreams() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
            this.realtimeInterval = null;
        }
    }

    // File Upload Handlers
    handleDragOver(e) {
        e.preventDefault();
        e.target.closest('.upload-area').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.target.closest('.upload-area').classList.remove('dragover');
    }

    handleFileDrop(e) {
        e.preventDefault();
        const uploadArea = e.target.closest('.upload-area');
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.processImageFile(files[0]);
        }
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.processImageFile(file);
        }
    }

    processImageFile(file) {
        const canvas = document.getElementById('upload-canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = Math.min(600, img.width);
            canvas.height = (canvas.width / img.width) * img.height;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.classList.remove('hidden');
            document.getElementById('analyze-upload-btn').classList.remove('hidden');
        };

        img.src = URL.createObjectURL(file);
    }

    // Camera Functions
    async startCamera(type) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            
            this.currentStream = stream;
            const video = document.getElementById(`${type}-video`);
            video.srcObject = stream;
            
            // Hide overlay and enable controls
            document.getElementById(`${type}-overlay`).style.display = 'none';
            
            if (type === 'camera') {
                document.getElementById('capture-btn').disabled = false;
                document.getElementById('stop-camera-btn').disabled = false;
            }
            
        } catch (error) {
            alert('カメラにアクセスできませんでした。ブラウザの設定を確認してください。');
            console.error('Camera access error:', error);
        }
    }

    stopCamera(type) {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        document.getElementById(`${type}-overlay`).style.display = 'flex';
        
        if (type === 'camera') {
            document.getElementById('capture-btn').disabled = true;
            document.getElementById('stop-camera-btn').disabled = true;
            document.getElementById('camera-canvas').classList.add('hidden');
            document.getElementById('analyze-camera-btn').classList.add('hidden');
        }
    }

    captureImage() {
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        canvas.classList.remove('hidden');
        document.getElementById('analyze-camera-btn').classList.remove('hidden');
    }

    // Real-time Analysis
    async startRealtimeAnalysis() {
        await this.startCamera('realtime');
        
        if (this.currentStream) {
            document.getElementById('realtime-overlay').style.display = 'none';
            document.getElementById('stop-realtime-btn').disabled = false;
            
            this.frameCount = 0;
            this.confidenceHistory = [];
            
            // Start real-time processing
            this.realtimeInterval = setInterval(() => {
                this.processRealtimeFrame();
            }, 1000); // Process every second
        }
    }

    stopRealtimeAnalysis() {
        this.stopCamera('realtime');
        
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
            this.realtimeInterval = null;
        }
        
        document.getElementById('stop-realtime-btn').disabled = true;
        document.getElementById('realtime-overlay').style.display = 'flex';
    }

    processRealtimeFrame() {
        const video = document.getElementById('realtime-video');
        const canvas = document.getElementById('realtime-canvas');
        const ctx = canvas.getContext('2d');

        if (video.videoWidth && video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // Simulate analysis
            const analysisResult = this.simulateImageAnalysis(ctx, canvas.width, canvas.height);
            this.frameCount++;
            this.confidenceHistory.push(analysisResult.confidence);

            // Update real-time display
            this.updateRealtimeResults(analysisResult);
            this.updateRealtimeStats();
        }
    }

    updateRealtimeStats() {
        document.getElementById('frame-count').textContent = this.frameCount;
        
        const avgConfidence = this.confidenceHistory.length > 0 
            ? this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length 
            : 0;
        document.getElementById('avg-confidence').textContent = `${Math.round(avgConfidence * 100)}%`;
    }

    updateRealtimeResults(result) {
        // Update primary emotion display
        document.getElementById('detected-emotion').textContent = result.emotion;
        document.getElementById('confidence-score').textContent = `${Math.round(result.confidence * 100)}%`;
    }

    // Analysis Functions
    analyzeUploadedImage() {
        const canvas = document.getElementById('upload-canvas');
        this.performAnalysis(canvas);
    }

    analyzeCapturedImage() {
        const canvas = document.getElementById('camera-canvas');
        this.performAnalysis(canvas);
    }

    async performAnalysis(canvas) {
        this.showLoading();
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const ctx = canvas.getContext('2d');
        const analysisResult = this.simulateImageAnalysis(ctx, canvas.width, canvas.height);
        
        this.displayResults(analysisResult);
        this.hideLoading();
        
        // Scroll to results
        document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
    }

    simulateImageAnalysis(ctx, width, height) {
        // Get image data for analysis
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Calculate basic image features
        let totalBrightness = 0;
        let totalPixels = data.length / 4;
        const colorChannels = { r: 0, g: 0, b: 0 };

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate brightness
            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;
            
            colorChannels.r += r;
            colorChannels.g += g;
            colorChannels.b += b;
        }

        const avgBrightness = totalBrightness / totalPixels;
        const avgColors = {
            r: colorChannels.r / totalPixels,
            g: colorChannels.g / totalPixels,
            b: colorChannels.b / totalPixels
        };

        // Determine emotion based on brightness
        let emotion, baseConfidence;
        if (avgBrightness > 200) {
            emotion = this.systemData.analysisParameters.brightnessBased.veryBright.emotion;
            baseConfidence = this.systemData.analysisParameters.brightnessBased.veryBright.confidence;
        } else if (avgBrightness > 150) {
            emotion = this.systemData.analysisParameters.brightnessBased.bright.emotion;
            baseConfidence = this.systemData.analysisParameters.brightnessBased.bright.confidence;
        } else if (avgBrightness > 100) {
            emotion = this.systemData.analysisParameters.brightnessBased.moderate.emotion;
            baseConfidence = this.systemData.analysisParameters.brightnessBased.moderate.confidence;
        } else {
            emotion = this.systemData.analysisParameters.brightnessBased.dark.emotion;
            baseConfidence = this.systemData.analysisParameters.brightnessBased.dark.confidence;
        }

        // Add some randomness for variety
        const randomVariation = (Math.random() - 0.5) * 0.1;
        const finalConfidence = Math.max(0.5, Math.min(0.95, baseConfidence + randomVariation));

        // Generate comprehensive analysis data
        return {
            emotion: emotion,
            confidence: finalConfidence,
            features: {
                avgBrightness: Math.round(avgBrightness),
                contrast: this.calculateContrast(data),
                hueDistribution: this.calculateHueDistribution(avgColors),
                symmetryIndex: Math.random() * 0.4 + 0.6 // Simulate symmetry
            },
            quantumProcessing: this.generateQuantumData(),
            neuromorphicComputing: this.generateNeuromorphicData(),
            swarmIntelligence: this.generateSwarmData(),
            multimodalFusion: this.generateMultimodalData()
        };
    }

    calculateContrast(data) {
        let min = 255, max = 0;
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            min = Math.min(min, brightness);
            max = Math.max(max, brightness);
        }
        return max - min;
    }

    calculateHueDistribution(avgColors) {
        const { r, g, b } = avgColors;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        if (delta === 0) return "モノクロ";
        if (max === r) return "赤系";
        if (max === g) return "緑系";
        return "青系";
    }

    generateQuantumData() {
        return {
            dimensions: Math.floor(Math.random() * 512 + 256),
            correlation: (Math.random() * 0.3 + 0.7).toFixed(3),
            superposition: (Math.random() * 0.4 + 0.6).toFixed(3)
        };
    }

    generateNeuromorphicData() {
        return {
            spikeFrequency: (Math.random() * 50 + 150).toFixed(1) + " Hz",
            powerReduction: (Math.random() * 20 + 70).toFixed(1) + "%",
            efficiencyImprovement: (Math.random() * 30 + 200).toFixed(1) + "%"
        };
    }

    generateSwarmData() {
        return {
            particleConvergence: (Math.random() * 0.15 + 0.85).toFixed(3),
            antEfficiency: (Math.random() * 0.2 + 0.8).toFixed(3),
            optimizationScore: (Math.random() * 0.1 + 0.9).toFixed(3)
        };
    }

    generateMultimodalData() {
        return {
            visualWeight: (Math.random() * 0.2 + 0.8).toFixed(3),
            integrationEfficiency: (Math.random() * 0.15 + 0.85).toFixed(3),
            temporalStability: (Math.random() * 0.1 + 0.9).toFixed(3)
        };
    }

    displayResults(result) {
        // Primary result
        document.getElementById('detected-emotion').textContent = result.emotion;
        document.getElementById('confidence-score').textContent = `${Math.round(result.confidence * 100)}%`;

        // Quantum processing
        document.getElementById('quantum-dimensions').textContent = result.quantumProcessing.dimensions;
        document.getElementById('quantum-correlation').textContent = result.quantumProcessing.correlation;
        document.getElementById('quantum-superposition').textContent = result.quantumProcessing.superposition;

        // Neuromorphic computing
        document.getElementById('spike-frequency').textContent = result.neuromorphicComputing.spikeFrequency;
        document.getElementById('power-reduction').textContent = result.neuromorphicComputing.powerReduction;
        document.getElementById('efficiency-improvement').textContent = result.neuromorphicComputing.efficiencyImprovement;

        // Swarm intelligence
        document.getElementById('particle-convergence').textContent = result.swarmIntelligence.particleConvergence;
        document.getElementById('ant-efficiency').textContent = result.swarmIntelligence.antEfficiency;
        document.getElementById('optimization-score').textContent = result.swarmIntelligence.optimizationScore;

        // Multimodal fusion
        document.getElementById('visual-weight').textContent = result.multimodalFusion.visualWeight;
        document.getElementById('integration-efficiency').textContent = result.multimodalFusion.integrationEfficiency;
        document.getElementById('temporal-stability').textContent = result.multimodalFusion.temporalStability;

        // Feature analysis
        document.getElementById('avg-brightness').textContent = result.features.avgBrightness;
        document.getElementById('contrast-level').textContent = Math.round(result.features.contrast);
        document.getElementById('hue-distribution').textContent = result.features.hueDistribution;
        document.getElementById('symmetry-index').textContent = result.features.symmetryIndex.toFixed(3);

        // Show results section
        document.getElementById('results-section').style.display = 'block';
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new QBHFERSystem();
});