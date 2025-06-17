
class QBHFERSystem {
    constructor() {
        this.emotionLabels = ["喜び", "悲しみ", "怒り", "驚き", "恐怖", "嫌悪", "軽蔑", "中立"];
        this.emotionColors = {
            "喜び": "#ff6384",
            "悲しみ": "#36a2eb", 
            "怒り": "#ff9f40",
            "驚き": "#4bc0c0",
            "恐怖": "#9966ff",
            "嫌悪": "#c9cbcf",
            "軽蔑": "#ff6b9d",
            "中立": "#95e1d3"
        };

        this.systemData = {
            emotionLabels: this.emotionLabels,
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
        this.emotionHistory = {};
        this.emotionChart = null;

        // FaceAPIの初期化
        this.faceDetectionNet = null;
        this.faceExpressionNet = null;
        this.isFaceAPILoaded = false;

        this.initializeEventListeners();
        this.initializeFaceAPI();
    }

    // Face-APIの初期化
    async initializeFaceAPI() {
        try {
            // モデルのパスを設定
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

            // モデルの読み込み
            await faceapi.loadTinyFaceDetectorModel(MODEL_URL);
            await faceapi.loadFaceLandmarkModel(MODEL_URL);
            await faceapi.loadFaceExpressionModel(MODEL_URL);

            console.log('Face-API models loaded successfully');
            this.isFaceAPILoaded = true;
        } catch (error) {
            console.error('Error loading Face-API models:', error);
        }
    }

    // イベントリスナーの初期化
    initializeEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // リアルタイム分析コントロール
        document.getElementById('start-realtime-btn').addEventListener('click', () => this.startRealtimeAnalysis());
        document.getElementById('stop-realtime-btn').addEventListener('click', () => this.stopRealtimeAnalysis());
    }

    // タブの切り替え
    switchTab(tabName) {
        // タブボタンの更新
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // タブコンテンツの更新
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // アクティブなストリームのクリーンアップ
        this.cleanupActiveStreams();
    }

    // アクティブなストリームのクリーンアップ
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

    // リアルタイム分析の開始
    async startRealtimeAnalysis() {
        if (!this.isFaceAPILoaded) {
            console.log('Face-API is not loaded yet. Please wait...');
            return;
        }

        await this.startCamera('realtime');
        if (this.currentStream) {
            document.getElementById('realtime-overlay').style.display = 'none';
            document.getElementById('stop-realtime-btn').disabled = false;

            this.frameCount = 0;
            this.confidenceHistory = [];

            // 感情履歴の初期化
            this.emotionHistory = {};
            this.emotionLabels.forEach(emotion => {
                this.emotionHistory[emotion] = [];
            });

            // 感情グラフの初期化
            this.initEmotionChart();

            // リアルタイム処理の開始
            this.realtimeInterval = setInterval(() => {
                this.processRealtimeFrame();
            }, 1000); // 1秒ごとに処理
        }
    }

    // リアルタイム分析の停止
    stopRealtimeAnalysis() {
        this.stopCamera('realtime');
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
            this.realtimeInterval = null;
        }

        document.getElementById('stop-realtime-btn').disabled = true;
        document.getElementById('realtime-overlay').style.display = 'flex';
    }

    // カメラの起動
    async startCamera(type) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });

            this.currentStream = stream;
            const video = document.getElementById(`${type}-video`);
            video.srcObject = stream;

            // オーバーレイを非表示にしてコントロールを有効化
            document.getElementById(`${type}-overlay`).style.display = 'none';

        } catch (error) {
            alert('カメラにアクセスできませんでした。ブラウザの設定を確認してください。');
            console.error('Camera access error:', error);
        }
    }

    // カメラの停止
    stopCamera(type) {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }

        document.getElementById(`${type}-overlay`).style.display = 'flex';
    }

    // リアルタイムフレームの処理
    async processRealtimeFrame() {
        const video = document.getElementById('realtime-video');
        const canvas = document.getElementById('realtime-canvas');
        const ctx = canvas.getContext('2d');

        if (video.videoWidth && video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // キャンバスをクリア
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
                // Face-APIを使用して顔と表情を検出
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceExpressions();

                if (detections && detections.length > 0) {
                    // 検出されたすべての顔に対して処理
                    detections.forEach(detection => {
                        const { detection: faceDetection, expressions } = detection;

                        // 顔の周りに四角を描画
                        const box = faceDetection.box;
                        ctx.strokeStyle = '#36a2eb';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(box.x, box.y, box.width, box.height);

                        // 最も確率が高い表情を取得
                        let maxExpression = '';
                        let maxValue = 0;
                        const emotionMapping = {
                            'happy': '喜び',
                            'sad': '悲しみ',
                            'angry': '怒り',
                            'surprised': '驚き',
                            'fearful': '恐怖',
                            'disgusted': '嫌悪',
                            'neutral': '中立'
                        };

                        for (const [expression, value] of Object.entries(expressions)) {
                            if (value > maxValue) {
                                maxValue = value;
                                maxExpression = emotionMapping[expression] || expression;
                            }
                        }

                        // 表情を顔の上に表示
                        ctx.fillStyle = this.emotionColors[maxExpression] || '#ffffff';
                        ctx.font = '18px Arial';
                        ctx.fillText(`${maxExpression}: ${(maxValue * 100).toFixed(0)}%`, box.x, box.y - 10);

                        // 現在の表情を更新
                        document.getElementById('current-emotion').textContent = maxExpression;

                        // 信頼度の履歴に追加
                        this.confidenceHistory.push(maxValue);

                        // 感情履歴の更新
                        this.updateEmotionHistory(maxExpression, maxValue);
                    });

                    this.frameCount++;
                    this.updateRealtimeStats();
                } else {
                    // 顔が検出されなかった場合
                    document.getElementById('current-emotion').textContent = '検出なし';
                }
            } catch (error) {
                console.error('Face detection error:', error);
            }
        }
    }

    // 感情履歴の更新
    updateEmotionHistory(emotion, value) {
        const timestamp = Date.now();

        // すべての感情に0を追加
        this.emotionLabels.forEach(label => {
            this.emotionHistory[label].push({
                x: timestamp,
                y: label === emotion ? value : 0
            });

            // 30秒分のデータを保持（30ポイント）
            if (this.emotionHistory[label].length > 30) {
                this.emotionHistory[label].shift();
            }
        });

        // グラフの更新
        if (this.emotionChart) {
            this.emotionChart.update();
        }
    }

    // リアルタイム統計の更新
    updateRealtimeStats() {
        document.getElementById('frame-count').textContent = this.frameCount;

        const avgConfidence = this.confidenceHistory.length > 0
            ? this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length
            : 0;

        document.getElementById('avg-confidence').textContent = `${Math.round(avgConfidence * 100)}%`;
    }

    // 感情グラフの初期化
    initEmotionChart() {
        const ctx = document.getElementById('emotion-chart').getContext('2d');

        if (this.emotionChart) {
            this.emotionChart.destroy();
        }

        // データセットの作成
        const datasets = this.emotionLabels.map(emotion => ({
            label: emotion,
            borderColor: this.emotionColors[emotion],
            backgroundColor: this.emotionColors[emotion] + '33', // 透明度を追加
            data: this.emotionHistory[emotion],
            fill: true,
            tension: 0.4
        }));

        // グラフの作成
        this.emotionChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'realtime',
                        realtime: {
                            duration: 30000, // 30秒間表示
                            refresh: 1000,   // 1秒ごとに更新
                            delay: 1000,     // 1秒の遅延
                            pause: false,
                            ttl: 60000       // 60秒でデータを削除
                        },
                        title: {
                            display: true,
                            text: '時間'
                        }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: {
                            display: true,
                            text: '強度'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'リアルタイム感情分析'
                    },
                    legend: {
                        position: 'bottom'
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
}

// システムの初期化
document.addEventListener('DOMContentLoaded', () => {
    new QBHFERSystem();
});
