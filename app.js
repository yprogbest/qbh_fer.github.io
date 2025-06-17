// 量子表情認識アプリ - メインJavaScript

// アプリケーションデータ
const appData = {
  emotions: [
    {"name": "喜び", "english": "happy", "color": "#ff6384"},
    {"name": "悲しみ", "english": "sad", "color": "#36a2eb"},
    {"name": "怒り", "english": "angry", "color": "#ff9f40"},
    {"name": "驚き", "english": "surprised", "color": "#4bc0c0"},
    {"name": "恐怖", "english": "fearful", "color": "#9966ff"},
    {"name": "嫌悪", "english": "disgusted", "color": "#c9cbcf"},
    {"name": "軽蔑", "english": "neutral", "color": "#ff6b9d"},
    {"name": "中立", "english": "neutral", "color": "#95e1d3"}
  ],
  systemData: {
    analysisParameters: {
      frameRate: 1000,
      dataRetention: 30,
      confidenceThreshold: 0.5,
      displayDuration: 30000
    }
  }
};

// アプリケーション状態
const appState = {
  isModelLoaded: false,
  isProcessing: false,
  isStreamActive: false,
  frameCount: 0,
  totalConfidence: 0,
  currentEmotion: '未検出',
  emotionData: {},
  emotionChart: null,
  videoStream: null,
  detectionInterval: null,
  cameraDevice: null
};

// DOM要素の参照
const elements = {
  video: document.getElementById('video'),
  overlay: document.getElementById('overlay'),
  loadingContainer: document.getElementById('loading-container'),
  loadingStatus: document.getElementById('loading-status'),
  startButton: document.getElementById('start-button'),
  stopButton: document.getElementById('stop-button'),
  frameCount: document.getElementById('frame-count'),
  avgConfidence: document.getElementById('avg-confidence'),
  currentEmotion: document.getElementById('current-emotion'),
  emotionChart: document.getElementById('emotion-chart'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane')
};

// タブ切り替え機能
elements.tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    
    // アクティブタブの切り替え
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // タブコンテンツの切り替え
    elements.tabPanes.forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // リアルタイムタブからの切り替え時、カメラを停止
    if (tabName !== 'realtime' && appState.isStreamActive) {
      stopCamera();
    }
  });
});

// Face-API.jsモデルのロード
async function loadFaceApiModels() {
  try {
    updateLoadingStatus('Face-API.jsモデルを読み込み中...');
    
    // 修正: モデルロードパスを修正
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/';
    
    // すべてのモデルを並行して読み込む
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    
    appState.isModelLoaded = true;
    updateLoadingStatus('モデルの読み込みが完了しました！');
    
    // ローディング画面を非表示
    setTimeout(() => {
      elements.loadingContainer.classList.add('hidden');
    }, 1000);
    
    console.log('Face-API.jsモデルがロードされました');
    initializeApp();
  } catch (error) {
    console.error('モデルのロード中にエラーが発生しました:', error);
    updateLoadingStatus('モデルのロード中にエラーが発生しました。ページを更新してください。');
  }
}

// ローディングステータスの更新
function updateLoadingStatus(message) {
  elements.loadingStatus.textContent = message;
}

// カメラストリームの開始
async function startCamera() {
  try {
    if (!appState.isModelLoaded) {
      // モデルが未ロードの場合も開始を許可
      console.warn('Face-API.jsモデルがまだロード中です。少し待ってから再試行してください。');
    }
    
    // すでに実行中の場合は何もしない
    if (appState.isStreamActive) return;
    
    // 開始ボタンを無効化して複数回クリックを防止
    elements.startButton.disabled = true;
    updateLoadingStatus('カメラへのアクセスを要求中...');
    elements.loadingContainer.classList.remove('hidden');
    
    // カメラストリームの取得（シンプルなオプションを使用）
    appState.videoStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
    
    // ビデオ要素にストリームを設定
    elements.video.srcObject = appState.videoStream;
    
    // ビデオが読み込まれたらオーバーレイのサイズを調整
    elements.video.onloadedmetadata = () => {
      // キャンバスサイズをビデオサイズに合わせる
      const { videoWidth, videoHeight } = elements.video;
      elements.overlay.width = videoWidth;
      elements.overlay.height = videoHeight;
      console.log(`ビデオサイズ設定: ${videoWidth}x${videoHeight}`);
    };
    
    // ビデオの再生開始を確実に行う
    try {
      await elements.video.play();
      console.log('ビデオの再生が開始されました');
    } catch (playError) {
      console.error('ビデオの再生開始に失敗しました:', playError);
      throw new Error('ビデオの再生開始に失敗しました。ブラウザの自動再生ポリシーを確認してください。');
    }
    
    // 処理フラグを更新
    appState.isStreamActive = true;
    appState.frameCount = 0;
    appState.totalConfidence = 0;
    
    // ボタン状態の更新
    elements.startButton.disabled = true;
    elements.stopButton.disabled = false;
    
    // 統計情報のリセット
    updateStats(0, 0, '検出中...');
    
    // 定期的な検出処理の開始
    startDetection();
    
    // ローディング画面を非表示
    elements.loadingContainer.classList.add('hidden');
    
    console.log('カメラストリームが開始されました');
  } catch (error) {
    console.error('カメラの開始中にエラーが発生しました:', error);
    elements.startButton.disabled = false;
    elements.loadingContainer.classList.add('hidden');
    showError('カメラの起動に失敗しました: ' + (error.message || 'カメラへのアクセス権限を確認してください。'));
  }
}

// カメラストリームの停止
function stopCamera() {
  // 検出処理の停止
  clearInterval(appState.detectionInterval);
  appState.detectionInterval = null;
  
  // ビデオストリームの停止
  if (appState.videoStream) {
    appState.videoStream.getTracks().forEach(track => track.stop());
    appState.videoStream = null;
  }
  
  // ビデオ要素のソースをクリア
  elements.video.srcObject = null;
  
  // オーバーレイをクリア
  const ctx = elements.overlay.getContext('2d');
  ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
  
  // 処理フラグの更新
  appState.isStreamActive = false;
  
  // ボタン状態の更新
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  
  console.log('カメラストリームが停止されました');
}

// 顔検出と表情認識の開始
function startDetection() {
  // 既存の検出処理をクリア
  if (appState.detectionInterval) {
    clearInterval(appState.detectionInterval);
  }
  
  // 新しい検出処理を設定
  appState.detectionInterval = setInterval(async () => {
    if (!appState.isStreamActive || appState.isProcessing) return;
    
    appState.isProcessing = true;
    try {
      await detectFace();
    } catch (error) {
      console.error('顔検出中にエラーが発生しました:', error);
    } finally {
      appState.isProcessing = false;
    }
  }, appData.systemData.analysisParameters.frameRate);
  
  console.log(`顔検出を開始しました（間隔: ${appData.systemData.analysisParameters.frameRate}ms）`);
}

// 顔検出と表情認識の処理
async function detectFace() {
  if (!elements.video.paused && !elements.video.ended) {
    // 顔検出と表情認識のオプション
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.5
    });
    
    try {
      // 顔検出と表情認識の実行
      const detections = await faceapi.detectAllFaces(elements.video, options)
        .withFaceLandmarks()
        .withFaceExpressions();
      
      // キャンバスのコンテキスト取得
      const ctx = elements.overlay.getContext('2d');
      ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
      
      // 検出結果があれば表示
      if (detections && detections.length > 0) {
        // 最初の顔のみ処理（複数検出の場合）
        const detection = detections[0];
        const expressions = detection.expressions;
        const box = detection.detection.box;
        
        // 最も確率が高い表情を特定
        let maxExpression = { name: 'neutral', confidence: 0 };
        Object.entries(expressions).forEach(([name, confidence]) => {
          if (confidence > maxExpression.confidence) {
            maxExpression = { name, confidence };
          }
        });
        
        // 表情に対応する日本語名を取得
        const emotionInfo = getEmotionInfo(maxExpression.name);
        
        // 顔の境界ボックスを描画
        ctx.lineWidth = 3;
        ctx.strokeStyle = emotionInfo.color;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // 表情ラベルの背景を描画
        const labelText = `${emotionInfo.name}: ${Math.round(maxExpression.confidence * 100)}%`;
        const labelWidth = ctx.measureText(labelText).width + 10;
        const labelHeight = 26;
        
        ctx.fillStyle = emotionInfo.color;
        ctx.fillRect(box.x, box.y - labelHeight - 4, labelWidth, labelHeight);
        
        // 表情ラベルのテキストを描画
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.fillText(labelText, box.x + 5, box.y - 10);
        
        // グラフデータの更新
        updateEmotionData(expressions);
        
        // 統計情報の更新
        appState.frameCount++;
        appState.totalConfidence += maxExpression.confidence;
        const avgConfidence = appState.totalConfidence / appState.frameCount;
        
        updateStats(
          appState.frameCount,
          Math.round(avgConfidence * 100),
          emotionInfo.name
        );
      } else {
        // 顔が検出されなかった場合
        updateEmotionData({}); // 空のデータでグラフを更新
      }
    } catch (error) {
      console.error('顔検出処理中にエラーが発生しました:', error);
    }
  }
}

// 表情情報の取得
function getEmotionInfo(expressionName) {
  // Face-API.jsの表情名をアプリの感情名にマッピング
  const mapping = {
    'happy': '喜び',
    'sad': '悲しみ',
    'angry': '怒り',
    'surprised': '驚き',
    'fearful': '恐怖',
    'disgusted': '嫌悪',
    'neutral': '中立'
  };
  
  // 対応する感情情報を取得
  const emotion = appData.emotions.find(e => e.english === expressionName) || 
                  appData.emotions.find(e => e.english === 'neutral');
  
  return {
    name: mapping[expressionName] || '不明',
    color: emotion ? emotion.color : '#cccccc'
  };
}

// 統計情報の更新
function updateStats(frames, confidence, emotion) {
  elements.frameCount.textContent = frames;
  elements.avgConfidence.textContent = `${confidence}%`;
  elements.currentEmotion.textContent = emotion;
  appState.currentEmotion = emotion;
}

// グラフデータの更新
function updateEmotionData(expressions) {
  const now = Date.now();
  
  // 各感情の値をデータセットに追加
  appData.emotions.forEach(emotion => {
    const englishName = emotion.english;
    // Face-APIの表情名に合わせる
    const apiName = (englishName === 'neutral' && emotion.name === '軽蔑') ? 'neutral' : englishName;
    
    // 対応する表情の信頼度を取得 (検出されていない場合は0)
    const confidence = expressions[apiName] || 0;
    
    // グラフデータの更新
    if (appState.emotionChart) {
      const dataset = appState.emotionChart.data.datasets.find(ds => ds.label === emotion.name);
      if (dataset) {
        dataset.data.push({
          x: now,
          y: confidence * 100
        });
      }
    }
  });
  
  // グラフの更新
  if (appState.emotionChart) {
    appState.emotionChart.update('quiet'); // パフォーマンス向上のため'quiet'モードで更新
  }
}

// グラフの初期化
function initializeChart() {
  if (!elements.emotionChart) {
    console.error('チャートのcanvas要素が見つかりません');
    return;
  }
  
  const ctx = elements.emotionChart.getContext('2d');
  
  // データセットの作成
  const datasets = appData.emotions.map((emotion, index) => ({
    label: emotion.name,
    data: [],
    backgroundColor: emotion.color,
    borderColor: emotion.color,
    borderWidth: 2,
    pointRadius: 0,
    fill: false,
    tension: 0.4
  }));
  
  // グラフの設定
  appState.emotionChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // パフォーマンス向上のためアニメーションを無効化
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 10
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        },
        streaming: {
          duration: appData.systemData.analysisParameters.displayDuration,
          refresh: 1000,
          delay: 1000,
          frameRate: 30,
          pause: false
        }
      },
      scales: {
        x: {
          type: 'realtime',
          realtime: {
            duration: appData.systemData.analysisParameters.displayDuration,
            refresh: 1000,
            delay: 1000,
            onRefresh: chart => {
              // ストリーミング更新時の処理（空でOK）
            }
          },
          title: {
            display: true,
            text: '時間'
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: '信頼度 (%)'
          }
        }
      }
    }
  });
  
  console.log('感情グラフが初期化されました');
}

// エラーメッセージの表示
function showError(message) {
  // 既存のエラーメッセージを削除
  document.querySelectorAll('.error-message').forEach(el => el.remove());
  
  // 新しいエラーメッセージを作成
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  
  // タブコンテンツの先頭に挿入
  const activeTab = document.querySelector('.tab-pane.active');
  if (activeTab) {
    activeTab.insertBefore(errorElement, activeTab.firstChild);
  } else {
    document.querySelector('.tab-content').appendChild(errorElement);
  }
  
  // 5秒後に自動的に消える
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}

// アプリケーションの初期化
function initializeApp() {
  // ボタンのイベントリスナー
  elements.startButton.addEventListener('click', startCamera);
  elements.stopButton.addEventListener('click', stopCamera);
  
  // グラフの初期化
  initializeChart();
  
  // DOMが確実に構築されているか確認
  if (elements.video && elements.overlay && elements.emotionChart) {
    console.log('DOM要素が正常に初期化されました');
  } else {
    console.warn('一部のDOM要素が見つかりません');
  }
  
  console.log('アプリケーションが初期化されました');
}

// ページロード時にFace-API.jsモデルをロード
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded イベントが発火しました');
  setTimeout(() => {
    loadFaceApiModels();
  }, 500); // ブラウザがDOM構築を完了するための短い遅延
});