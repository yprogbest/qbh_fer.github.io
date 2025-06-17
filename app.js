// QBH-FER 表情認識システム
class QBHFERSystem {
    constructor() {
        this.isModelsLoaded = false;
        this.isRealtimeActive = false;
        this.emotionChart = null;
        this.emotionData = [];
        this.chartStartTime = Date.now();
        this.modelLoadingPromise = null;
        
        // 感情設定
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
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.initChart();
        this.showLoading('モデルを読み込み中...');
        
        // モデル読み込みを非同期に開始
        this.modelLoadingPromise = this.loadModels().finally(() => {
            this.hideLoading();
        });
    }
    
    setupEventListeners() {
        // タブナビゲーション
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // 画像アップロード
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // カメラ制御
        document.getElementById('start-camera').addEventListener('click', this.startCamera.bind(this));
        document.getElementById('capture-photo').addEventListener('click', this.capturePhoto.bind(this));
        document.getElementById('stop-camera').addEventListener('click', this.stopCamera.bind(this));
        
        // リアルタイム分析
        document.getElementById('start-realtime').addEventListener('click', this.startRealtime.bind(this));
        document.getElementById('stop-realtime').addEventListener('click', this.stopRealtime.bind(this));
    }
    
    async loadModels() {
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.10/model/';
            
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
            ]);
            
            this.isModelsLoaded = true;
            console.log('Face-api.js models loaded successfully');
        } catch (error) {
            console.error('Failed to load models:', error);
            this.showError('モデルの読み込みに失敗しました。ページを再読み込みしてください。');
            throw error;
        }
    }
    
    switchTab(tabName) {
        // タブボタンの状態更新
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // タブコンテンツの表示切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // リアルタイム分析を停止
        if (this.isRealtimeActive && tabName !== 'realtime') {
            this.stopRealtime();
        }
        
        // カメラを停止
        if (tabName !== 'camera' && this.cameraStream) {
            this.stopCamera();
        }
    }
    
    // 画像アップロード機能
    handleDrop(e) {
        e.preventDefault();
        const uploadArea = e.currentTarget;
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processUploadedFile(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processUploadedFile(file);
        }
    }
    
    async processUploadedFile(file) {
        // モデルが読み込まれるまで待機
        await this.ensureModelsLoaded();
        
        if (!file.type.startsWith('image/')) {
            this.showError('画像ファイルを選択してください。');
            return;
        }
        
        this.showLoading('画像を処理中...');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.analyzeImage(img, 'upload');
                this.hideLoading();
            };
            img.onerror = () => {
                this.hideLoading();
                this.showError('画像の読み込みに失敗しました。');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            this.hideLoading();
            this.showError('ファイルの読み込みに失敗しました。');
        };
        reader.readAsDataURL(file);
    }
    
    // カメラ機能
    async startCamera() {
        // モデルが読み込まれるまで待機
        await this.ensureModelsLoaded();
        
        try {
            this.showLoading('カメラにアクセス中...');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            
            const video = document.getElementById('camera-video');
            video.srcObject = stream;
            
            // ビデオの読み込みを待機
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            await video.play();
            this.cameraStream = stream;
            
            // ボタン状態更新
            document.getElementById('start-camera').classList.add('hidden');
            document.getElementById('capture-photo').classList.remove('hidden');
            document.getElementById('stop-camera').classList.remove('hidden');
            
            this.hideLoading();
            
        } catch (error) {
            this.hideLoading();
            console.error('Camera access failed:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showError('カメラへのアクセスが拒否されました。ブラウザの設定で許可してください。');
            } else if (error.name === 'NotFoundError') {
                this.showError('カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。');
            } else {
                this.showError('カメラへのアクセスに失敗しました: ' + error.message);
            }
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        const ctx = canvas.getContext('2d');
        
        // ビデオが読み込まれていることを確認
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            this.showError('カメラ映像がまだ準備できていません。少し待ってから再試行してください。');
            return;
        }
        
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.classList.remove('hidden');
        video.classList.add('hidden');
        
        this.analyzeCanvas(canvas, 'camera');
    }
    
    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        
        video.srcObject = null;
        video.classList.remove('hidden');
        canvas.classList.add('hidden');
        
        // ボタン状態更新
        document.getElementById('start-camera').classList.remove('hidden');
        document.getElementById('capture-photo').classList.add('hidden');
        document.getElementById('stop-camera').classList.add('hidden');
        
        // 結果をクリア
        document.getElementById('camera-results').classList.add('hidden');
    }
    
    // リアルタイム分析
    async startRealtime() {
        // モデルが読み込まれるまで待機
        await this.ensureModelsLoaded();
        
        try {
            this.showLoading('カメラにアクセス中...');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            
            const video = document.getElementById('realtime-video');
            const canvas = document.getElementById('realtime-overlay');
            
            video.srcObject = stream;
            this.realtimeStream = stream;
            
            // ビデオの読み込みを待機
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            await video.play();
            this.isRealtimeActive = true;
            
            // キャンバスサイズ調整
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            
            // ボタン状態更新
            document.getElementById('start-realtime').classList.add('hidden');
            document.getElementById('stop-realtime').classList.remove('hidden');
            document.getElementById('current-emotion').classList.remove('hidden');
            
            // リアルタイム処理開始
            this.realtimeInterval = setInterval(() => {
                this.processRealtimeFrame();
            }, 1000); // 1秒ごと
            
            // チャートデータリセット
            this.emotionData = [];
            this.chartStartTime = Date.now();
            this.updateChart();
            
            this.hideLoading();
            
        } catch (error) {
            this.hideLoading();
            console.error('Realtime camera access failed:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showError('カメラへのアクセスが拒否されました。ブラウザの設定で許可してください。');
            } else if (error.name === 'NotFoundError') {
                this.showError('カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。');
            } else {
                this.showError('カメラへのアクセスに失敗しました: ' + error.message);
            }
        }
    }
    
    stopRealtime() {
        this.isRealtimeActive = false;
        
        if (this.realtimeStream) {
            this.realtimeStream.getTracks().forEach(track => track.stop());
            this.realtimeStream = null;
        }
        
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
            this.realtimeInterval = null;
        }
        
        // ボタン状態更新
        document.getElementById('start-realtime').classList.remove('hidden');
        document.getElementById('stop-realtime').classList.add('hidden');
        document.getElementById('current-emotion').classList.add('hidden');
        
        // オーバーレイクリア
        const canvas = document.getElementById('realtime-overlay');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // ビデオリセット
        const video = document.getElementById('realtime-video');
        video.srcObject = null;
    }
    
    async processRealtimeFrame() {
        if (!this.isRealtimeActive || !this.isModelsLoaded) return;
        
        const video = document.getElementById('realtime-video');
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
        
        try {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
                .withFaceExpressions()
                .withFaceLandmarks();
            
            this.drawRealtimeOverlay(detections);
            
            if (detections.length > 0) {
                const expressions = detections[0].expressions;
                this.updateCurrentEmotion(expressions);
                this.updateEmotionChart(expressions);
            } else {
                // 顔が検出されない場合
                document.querySelector('.emotion-name').textContent = '顔が見つかりません';
                document.querySelector('.emotion-confidence').textContent = '-';
            }
            
        } catch (error) {
            console.error('Realtime processing error:', error);
        }
    }
    
    drawRealtimeOverlay(detections) {
        const canvas = document.getElementById('realtime-overlay');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        detections.forEach(detection => {
            const { x, y, width, height } = detection.detection.box;
            
            // 顔の境界線
            ctx.strokeStyle = '#21808d';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // ランドマーク
            if (detection.landmarks) {
                ctx.fillStyle = '#21808d';
                detection.landmarks.positions.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }
        });
    }
    
    updateCurrentEmotion(expressions) {
        const dominant = this.getDominantEmotion(expressions);
        const emotionName = document.querySelector('.emotion-name');
        const emotionConfidence = document.querySelector('.emotion-confidence');
        
        if (dominant) {
            emotionName.textContent = this.getEmotionNameInJapanese(dominant.emotion);
            emotionConfidence.textContent = `${Math.round(dominant.value * 100)}%`;
            
            // 信頼度に応じて色を変更
            const confidence = dominant.value;
            if (confidence > 0.7) {
                emotionName.style.color = '#10b981'; // 高信頼度: 緑
            } else if (confidence > 0.4) {
                emotionName.style.color = '#f59e0b'; // 中信頼度: オレンジ
            } else {
                emotionName.style.color = '#ef4444'; // 低信頼度: 赤
            }
        }
    }
    
    updateEmotionChart(expressions) {
        const now = Date.now();
        const timeOffset = (now - this.chartStartTime) / 1000; // 秒
        
        // 30秒を超えたデータを削除
        this.emotionData = this.emotionData.filter(data => data.time > timeOffset - 30);
        
        // 新しいデータを追加
        const newDataPoint = { time: timeOffset };
        
        this.emotions.forEach(emotion => {
            const key = this.getEmotionKey(emotion.name);
            newDataPoint[emotion.name] = expressions[key] || 0;
        });
        
        this.emotionData.push(newDataPoint);
        
        // グラフを更新
        this.updateChart();
    }
    
    // 画像・キャンバス分析
    async analyzeImage(img, type) {
        if (!this.isModelsLoaded) {
            await this.ensureModelsLoaded();
        }
        
        const canvas = document.getElementById(`${type}-canvas`);
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        canvas.classList.remove('hidden');
        
        this.showLoading('表情を分析中...');
        await this.analyzeCanvas(canvas, type);
        this.hideLoading();
    }
    
    async analyzeCanvas(canvas, type) {
        try {
            const detections = await faceapi
                .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
                .withFaceExpressions()
                .withFaceLandmarks();
            
            this.drawDetections(canvas, detections);
            this.displayResults(detections, type);
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('表情分析中にエラーが発生しました。');
        }
    }
    
    drawDetections(canvas, detections) {
        const ctx = canvas.getContext('2d');
        
        detections.forEach(detection => {
            const { x, y, width, height } = detection.detection.box;
            
            // 顔の境界線
            ctx.strokeStyle = '#21808d';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);
            
            // ランドマーク
            if (detection.landmarks) {
                ctx.fillStyle = '#21808d';
                detection.landmarks.positions.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }
        });
    }
    
    displayResults(detections, type) {
        const resultsContainer = document.getElementById(`${type}-results`);
        
        if (detections.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center">顔が検出されませんでした。</p>';
        } else {
            const expressions = detections[0].expressions;
            resultsContainer.innerHTML = this.formatResults(expressions);
        }
        
        resultsContainer.classList.remove('hidden');
    }
    
    formatResults(expressions) {
        let html = '<h3>表情分析結果</h3>';
        
        const sortedExpressions = Object.entries(expressions)
            .sort(([,a], [,b]) => b - a)
            .map(([key, value]) => ({
                name: this.getEmotionNameInJapanese(key),
                value: value,
                color: this.getEmotionColor(key)
            }));
        
        sortedExpressions.forEach(emotion => {
            const percentage = Math.round(emotion.value * 100);
            html += `
                <div class="result-item">
                    <span class="emotion-label">${emotion.name}</span>
                    <div class="emotion-bar">
                        <div class="emotion-bar-fill" style="width: ${percentage}%; background-color: ${emotion.color};"></div>
                    </div>
                    <span class="emotion-score">${percentage}%</span>
                </div>
            `;
        });
        
        return html;
    }
    
    // チャート初期化・更新
    initChart() {
        const ctx = document.getElementById('emotion-chart').getContext('2d');
        
        const datasets = this.emotions.map(emotion => ({
            label: emotion.name,
            borderColor: emotion.color,
            backgroundColor: emotion.color + '20',
            data: [],
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
        }));
        
        this.emotionChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: 30,
                        title: {
                            display: true,
                            text: '時間 (秒)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: {
                            display: true,
                            text: '信頼度'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
        
        // 初期データを追加してグラフを表示
        const timePoints = Array.from({ length: 30 }, (_, i) => i);
        this.emotions.forEach((emotion, index) => {
            this.emotionChart.data.datasets[index].data = timePoints.map(time => ({
                x: time,
                y: 0
            }));
        });
        this.emotionChart.update();
    }
    
    updateChart() {
        if (!this.emotionChart) return;
        
        // データを更新
        this.emotions.forEach((emotion, index) => {
            const values = this.emotionData.map(d => ({
                x: d.time,
                y: d[emotion.name] || 0
            }));
            
            this.emotionChart.data.datasets[index].data = values;
        });
        
        // X軸の範囲を更新
        const timeMin = Math.max(0, this.emotionData.length > 0 ? this.emotionData[this.emotionData.length - 1].time - 30 : 0);
        const timeMax = Math.max(30, this.emotionData.length > 0 ? this.emotionData[this.emotionData.length - 1].time : 30);
        
        this.emotionChart.options.scales.x.min = timeMin;
        this.emotionChart.options.scales.x.max = timeMax;
        
        this.emotionChart.update();
    }
    
    // ヘルパー関数
    async ensureModelsLoaded() {
        if (!this.isModelsLoaded) {
            if (!this.modelLoadingPromise) {
                this.showLoading('モデルを読み込み中...');
                this.modelLoadingPromise = this.loadModels().finally(() => {
                    this.hideLoading();
                });
            }
            
            await this.modelLoadingPromise;
        }
    }
    
    getDominantEmotion(expressions) {
        let max = 0;
        let dominant = null;
        
        Object.entries(expressions).forEach(([emotion, value]) => {
            const threshold = this.getEmotionThreshold(emotion);
            
            // 閾値を超えた感情のみ考慮
            if (value > threshold && value > max) {
                max = value;
                dominant = { emotion, value };
            }
        });
        
        // 閾値を超える感情がない場合は最大値の感情を返す
        if (!dominant) {
            Object.entries(expressions).forEach(([emotion, value]) => {
                if (value > max) {
                    max = value;
                    dominant = { emotion, value };
                }
            });
        }
        
        return dominant;
    }
    
    getEmotionNameInJapanese(englishName) {
        const mapping = {
            'happy': '喜び',
            'sad': '悲しみ',
            'angry': '怒り',
            'surprised': '驚き',
            'fearful': '恐怖',
            'disgusted': '嫌悪',
            'contempt': '軽蔑',
            'neutral': '中立'
        };
        return mapping[englishName] || englishName;
    }
    
    getEmotionKey(japaneseName) {
        const mapping = {
            '喜び': 'happy',
            '悲しみ': 'sad',
            '怒り': 'angry',
            '驚き': 'surprised',
            '恐怖': 'fearful',
            '嫌悪': 'disgusted',
            '軽蔑': 'contempt',
            '中立': 'neutral'
        };
        return mapping[japaneseName] || 'neutral';
    }
    
    getEmotionColor(englishName) {
        const emotion = this.emotions.find(e => e.key === englishName);
        return emotion ? emotion.color : '#95e1d3';
    }
    
    getEmotionThreshold(englishName) {
        const emotion = this.emotions.find(e => e.key === englishName);
        return emotion ? emotion.threshold : 0.5;
    }
    
    // UI制御
    showLoading(message = 'データを処理中...') {
        const loading = document.getElementById('loading');
        loading.querySelector('p').textContent = message;
        loading.classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
    
    showError(message) {
        document.getElementById('error-text').textContent = message;
        document.getElementById('error-message').classList.remove('hidden');
    }
}

// グローバル関数
function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

// デバイスチェック
function checkDeviceCompatibility() {
    // カメラAPIの確認
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.body.innerHTML = `
            <div class="container py-16">
                <div class="card">
                    <div class="card__body text-center">
                        <h1 class="mb-16">互換性エラー</h1>
                        <p>お使いのブラウザはカメラAPIをサポートしていないため、このアプリケーションを利用できません。</p>
                        <p>Chrome、Firefox、Safariなどの最新ブラウザをお試しください。</p>
                    </div>
                </div>
            </div>
        `;
        return false;
    }
    return true;
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    if (checkDeviceCompatibility()) {
        new QBHFERSystem();
    }
});