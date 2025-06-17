// QBH-FER 表情認識システム - メインアプリケーション
class FaceEmotionRecognizer {
    constructor() {
        this.isModelLoaded = false;
        this.isRealtimeActive = false;
        this.realtimeInterval = null;
        this.currentStream = null;
        
        // 表情データ
        this.emotions = [
            {name: "喜び", color: "#ff6384", threshold: 0.45, key: "happy"},
            {name: "悲しみ", color: "#36a2eb", threshold: 0.4, key: "sad"},
            {name: "怒り", color: "#ff9f40", threshold: 0.4, key: "angry"},
            {name: "驚き", color: "#4bc0c0", threshold: 0.4, key: "surprised"},
            {name: "恐怖", color: "#9966ff", threshold: 0.4, key: "fearful"},
            {name: "嫌悪", color: "#c9cbcf", threshold: 0.4, key: "disgusted"},
            {name: "軽蔑", color: "#ff6b9d", threshold: 0.4, key: "contempt"},
            {name: "中立", color: "#95e1d3", threshold: 0.5, key: "neutral"}
        ];
        
        this.modelUrls = [
            'https://justadudewhohacks.github.io/face-api.js/weights',
            'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'
        ];
        
        this.init();
    }
    
    async init() {
        // Face-api.jsが読み込まれるまで待つ
        const maxWaitTime = 10000; // 10秒
        const startTime = Date.now();
        
        while (typeof faceapi === 'undefined' && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (typeof faceapi === 'undefined') {
            this.showError('Face-api.jsライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
            return;
        }
        
        try {
            await this.loadModels();
            this.setupEventListeners();
            this.hideLoading();
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('初期化エラー: モデルの読み込みに失敗しました。ネットワーク接続を確認してページを再読み込みしてください。');
        }
    }
    
    async loadModels() {
        try {
            // タイムアウトを設定
            const timeout = 30000; // 30秒
            
            const loadWithTimeout = (promise) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('タイムアウト')), timeout)
                    )
                ]);
            };
            
            // モデル読み込みを試行
            for (const modelUrl of this.modelUrls) {
                try {
                    console.log('モデル読み込み開始:', modelUrl);
                    
                    await loadWithTimeout(Promise.all([
                        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
                        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
                        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
                        faceapi.nets.faceExpressionNet.loadFromUri(modelUrl)
                    ]));
                    
                    this.isModelLoaded = true;
                    console.log('モデル読み込み完了:', modelUrl);
                    return;
                } catch (error) {
                    console.warn('モデル読み込み失敗:', modelUrl, error.message);
                    continue;
                }
            }
            
            // 全てのソースで失敗した場合、デモモードとして続行
            console.warn('モデル読み込みに失敗しましたが、デモモードで続行します');
            this.isModelLoaded = false;
            
        } catch (error) {
            console.error('モデル読み込みエラー:', error);
            this.isModelLoaded = false;
        }
    }
    
    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // 画像アップロード
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) this.handleFileUpload(files[0]);
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleFileUpload(e.target.files[0]);
        });
        
        // アップロード関連ボタン
        document.getElementById('analyzeUpload').addEventListener('click', () => this.analyzeUploadedImage());
        document.getElementById('resetUpload').addEventListener('click', () => this.resetUpload());
        
        // カメラ関連ボタン
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capturePhoto').addEventListener('click', () => this.capturePhoto());
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera());
        document.getElementById('analyzeCapture').addEventListener('click', () => this.analyzeCapturedImage());
        document.getElementById('retakePhoto').addEventListener('click', () => this.retakePhoto());
        
        // リアルタイム関連ボタン
        document.getElementById('startRealtime').addEventListener('click', () => this.startRealtime());
        document.getElementById('stopRealtime').addEventListener('click', () => this.stopRealtime());
        
        // エラーメッセージ
        document.getElementById('dismissError').addEventListener('click', () => this.hideError());
    }
    
    switchTab(tabName) {
        // アクティブなタブを更新
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        // リアルタイム分析を停止
        if (tabName !== 'realtime') {
            this.stopRealtime();
        }
        
        // カメラを停止
        if (tabName !== 'camera') {
            this.stopCamera();
        }
    }
    
    hideLoading() {
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }
    
    showError(message) {
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorMessage').classList.remove('hidden');
    }
    
    hideError() {
        document.getElementById('errorMessage').classList.add('hidden');
    }
    
    // 画像アップロード処理
    handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('画像ファイルを選択してください');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB制限
            this.showError('ファイルサイズが大きすぎます（10MB以下にしてください）');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('previewImage');
            img.src = e.target.result;
            img.onload = () => {
                document.getElementById('uploadZone').classList.add('hidden');
                document.getElementById('previewSection').classList.remove('hidden');
                this.setupCanvas('uploadCanvas', img);
            };
        };
        reader.readAsDataURL(file);
    }
    
    async analyzeUploadedImage() {
        const img = document.getElementById('previewImage');
        const canvas = document.getElementById('uploadCanvas');
        await this.detectEmotions(img, canvas, 'uploadResults', 'uploadDominantEmotion', 'uploadEmotionList');
    }
    
    resetUpload() {
        document.getElementById('uploadZone').classList.remove('hidden');
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('uploadResults').classList.add('hidden');
        document.getElementById('fileInput').value = '';
    }
    
    // カメラ処理
    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            this.currentStream = stream;
            
            const video = document.getElementById('cameraVideo');
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                this.setupCanvas('cameraCanvas', video);
            };
            
            document.getElementById('startCamera').classList.add('hidden');
            document.getElementById('capturePhoto').classList.remove('hidden');
            document.getElementById('stopCamera').classList.remove('hidden');
            
        } catch (error) {
            this.showError('カメラへのアクセスに失敗しました: ' + error.message);
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('captureCanvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const dataURL = canvas.toDataURL('image/png');
        const capturedImage = document.getElementById('capturedImage');
        capturedImage.src = dataURL;
        
        document.getElementById('capturePreview').classList.remove('hidden');
        document.getElementById('cameraResults').classList.add('hidden');
    }
    
    async analyzeCapturedImage() {
        const img = document.getElementById('capturedImage');
        const canvas = document.createElement('canvas');
        await this.detectEmotions(img, canvas, 'cameraResults', 'cameraDominantEmotion', 'cameraEmotionList');
    }
    
    retakePhoto() {
        document.getElementById('capturePreview').classList.add('hidden');
        document.getElementById('cameraResults').classList.add('hidden');
    }
    
    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        document.getElementById('startCamera').classList.remove('hidden');
        document.getElementById('capturePhoto').classList.add('hidden');
        document.getElementById('stopCamera').classList.add('hidden');
        document.getElementById('capturePreview').classList.add('hidden');
        document.getElementById('cameraResults').classList.add('hidden');
    }
    
    // リアルタイム分析
    async startRealtime() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            this.currentStream = stream;
            
            const video = document.getElementById('realtimeVideo');
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                this.setupCanvas('realtimeCanvas', video);
                this.isRealtimeActive = true;
                this.realtimeInterval = setInterval(() => this.realtimeAnalysis(), 1000);
                
                document.getElementById('startRealtime').classList.add('hidden');
                document.getElementById('stopRealtime').classList.remove('hidden');
                document.getElementById('realtimeResults').classList.remove('hidden');
            };
            
        } catch (error) {
            this.showError('リアルタイム分析の開始に失敗しました: ' + error.message);
        }
    }
    
    async realtimeAnalysis() {
        if (!this.isRealtimeActive) return;
        
        const video = document.getElementById('realtimeVideo');
        const canvas = document.getElementById('realtimeCanvas');
        
        await this.detectEmotions(video, canvas, 'realtimeResults', 'realtimeDominantEmotion', 'realtimeEmotionList');
    }
    
    stopRealtime() {
        this.isRealtimeActive = false;
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
            this.realtimeInterval = null;
        }
        
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        document.getElementById('startRealtime').classList.remove('hidden');
        document.getElementById('stopRealtime').classList.add('hidden');
        document.getElementById('realtimeResults').classList.add('hidden');
    }
    
    // キャンバス設定
    setupCanvas(canvasId, mediaElement) {
        const canvas = document.getElementById(canvasId);
        const rect = mediaElement.getBoundingClientRect();
        
        canvas.width = mediaElement.videoWidth || mediaElement.naturalWidth;
        canvas.height = mediaElement.videoHeight || mediaElement.naturalHeight;
        
        canvas.style.width = mediaElement.offsetWidth + 'px';
        canvas.style.height = mediaElement.offsetHeight + 'px';
    }
    
    // 感情検出メイン処理
    async detectEmotions(mediaElement, canvas, resultsId, dominantId, listId) {
        if (!this.isModelLoaded) {
            // デモデータを使用
            this.showDemoResults(resultsId, dominantId, listId);
            return;
        }
        
        try {
            const detections = await faceapi
                .detectAllFaces(mediaElement, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();
            
            if (detections.length === 0) {
                this.showError('顔が検出されませんでした');
                return;
            }
            
            // 最初の顔の感情を分析
            const expressions = detections[0].expressions;
            const emotionResults = this.processEmotions(expressions);
            
            // 結果を表示
            this.displayResults(emotionResults, resultsId, dominantId, listId);
            
            // 顔の位置を描画
            this.drawFaceDetection(canvas, detections[0], mediaElement);
            
        } catch (error) {
            console.error('感情分析エラー:', error);
            this.showDemoResults(resultsId, dominantId, listId);
        }
    }
    
    // デモ結果表示
    showDemoResults(resultsId, dominantId, listId) {
        const demoExpressions = {
            happy: 0.75,
            sad: 0.1,
            angry: 0.05,
            surprised: 0.02,
            fearful: 0.03,
            disgusted: 0.02,
            contempt: 0.01,
            neutral: 0.02
        };
        
        const emotionResults = this.processEmotions(demoExpressions);
        this.displayResults(emotionResults, resultsId, dominantId, listId);
        
        // デモメッセージを表示
        setTimeout(() => {
            this.showError('デモモード: 実際の顔認識ではなく、サンプルデータを表示しています。モデルの読み込みに失敗したため、デモ機能で動作しています。');
        }, 1000);
    }
    
    // 感情データ処理
    processEmotions(expressions) {
        const results = [];
        
        this.emotions.forEach(emotion => {
            const probability = expressions[emotion.key] || 0;
            results.push({
                ...emotion,
                probability: probability,
                percentage: Math.round(probability * 100)
            });
        });
        
        // 確率順にソート
        results.sort((a, b) => b.probability - a.probability);
        
        return results;
    }
    
    // 結果表示
    displayResults(emotionResults, resultsId, dominantId, listId) {
        const resultsSection = document.getElementById(resultsId);
        const dominantSection = document.getElementById(dominantId);
        const listSection = document.getElementById(listId);
        
        // 最も確率の高い感情を表示
        const dominant = emotionResults[0];
        dominantSection.className = 'dominant-emotion has-emotion';
        dominantSection.style.borderColor = dominant.color;
        dominantSection.style.background = `linear-gradient(135deg, ${dominant.color}15, ${dominant.color}25)`;
        dominantSection.innerHTML = `
            <span class="dominant-emotion-name" style="color: ${dominant.color}">
                ${dominant.name}
            </span>
            <span class="dominant-emotion-probability" style="color: ${dominant.color}">
                ${dominant.percentage}%
            </span>
        `;
        
        // 全ての感情リストを表示
        listSection.innerHTML = '';
        emotionResults.forEach((emotion, index) => {
            const emotionItem = document.createElement('div');
            emotionItem.className = `emotion-item ${index === 0 ? 'dominant' : ''}`;
            
            if (index === 0) {
                emotionItem.style.borderColor = emotion.color;
                emotionItem.style.backgroundColor = `${emotion.color}10`;
            }
            
            emotionItem.innerHTML = `
                <div class="emotion-name" style="color: ${emotion.color}">
                    ${emotion.name}
                </div>
                <div class="emotion-probability" style="color: ${emotion.color}">
                    ${emotion.percentage}%
                </div>
                <div class="emotion-bar">
                    <div class="emotion-bar-fill" style="width: ${emotion.percentage}%; background-color: ${emotion.color}"></div>
                </div>
            `;
            
            listSection.appendChild(emotionItem);
        });
        
        resultsSection.classList.remove('hidden');
    }
    
    // 顔検出結果を描画
    drawFaceDetection(canvas, detection, mediaElement) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 顔の境界ボックスを描画
        const box = detection.detection.box;
        ctx.strokeStyle = '#ff6384';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // 顔のランドマークを描画
        const landmarks = detection.landmarks;
        ctx.fillStyle = '#ff6384';
        landmarks.positions.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new FaceEmotionRecognizer();
});