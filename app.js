// QBH-FER Application JavaScript

class QBHFERApp {
  constructor() {
    this.isModelsLoaded = false;
    this.currentStream = null;
    this.realtimeStream = null;
    this.realtimeChart = null;
    this.isRealtimeRunning = false;
    this.realtimeInterval = null;
    this.modelLoadRetryCount = 0;
    
    // Emotion configuration from provided data
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
    
    this.chartConfig = {
      duration: 30000,
      refresh: 1000,
      delay: 500
    };
    
    this.init();
  }

  async init() {
    try {
      this.showLoading('モデルを読み込み中...');
      this.setupEventListeners();
      await this.loadFaceApiModels();
      this.hideLoading();
      this.showMessage('success', 'QBH-FERシステムが正常に初期化されました');
    } catch (error) {
      this.hideLoading();
      this.showMessage('error', `初期化エラー: ${error.message}\n\n「閉じる」ボタンをクリックすると、画像アップロードとカメラ機能を使用できます。`);
      console.error('Initialization error:', error);
    }
  }

  async loadFaceApiModels() {
    try {
      // Using multiple CDN options for model loading reliability
      const MODEL_URLS = [
        'https://justadudewhohacks.github.io/face-api.js/weights',
        'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
      ];
      
      let modelLoadSuccess = false;
      let lastError = null;
      
      // Try each model URL until one works
      for (const MODEL_URL of MODEL_URLS) {
        try {
          console.log(`Attempting to load Face-api.js models from: ${MODEL_URL}`);
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
          ]);
          modelLoadSuccess = true;
          console.log(`Successfully loaded models from: ${MODEL_URL}`);
          break;
        } catch (error) {
          console.error(`Failed to load models from ${MODEL_URL}:`, error);
          lastError = error;
        }
      }
      
      if (!modelLoadSuccess) {
        throw lastError || new Error('すべてのモデルソースからの読み込みに失敗しました');
      }
      
      this.isModelsLoaded = true;
    } catch (error) {
      console.error('Model loading error:', error);
      // Set partial functionality flag
      this.isModelsLoaded = false;
      throw new Error('顔認識モデルの読み込みに失敗しました。インターネット接続を確認してください。アプリの一部機能が制限されます。');
    }
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Upload functionality
    this.setupUploadListeners();
    
    // Camera functionality
    this.setupCameraListeners();
    
    // Realtime functionality
    this.setupRealtimeListeners();
    
    // Message overlay
    document.getElementById('messageCloseBtn').addEventListener('click', () => {
      this.hideMessage();
    });
  }

  setupUploadListeners() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    
    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFileSelect(e.target.files[0]);
      }
    });
    
    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, this.preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });
    
    dropArea.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });
    
    dropArea.addEventListener('click', () => fileInput.click());
    
    // Analysis button
    document.getElementById('analyzeUploadBtn').addEventListener('click', () => this.analyzeUploadedImage());
    
    // Reset button
    document.getElementById('resetUpload').addEventListener('click', () => this.resetUpload());
  }

  setupCameraListeners() {
    document.getElementById('startCameraBtn').addEventListener('click', () => this.startCamera());
    document.getElementById('stopCameraBtn').addEventListener('click', () => this.stopCamera());
    document.getElementById('takePictureBtn').addEventListener('click', () => this.takePicture());
    document.getElementById('analyzeCaptureBtn').addEventListener('click', () => this.analyzeCapturedImage());
    document.getElementById('resetCapture').addEventListener('click', () => this.resetCapture());
  }

  setupRealtimeListeners() {
    document.getElementById('startRealtimeBtn').addEventListener('click', () => this.startRealtime());
    document.getElementById('stopRealtimeBtn').addEventListener('click', () => this.stopRealtime());
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Clean up when switching tabs
    if (tabName !== 'camera') {
      this.stopCamera();
    }
    if (tabName !== 'realtime') {
      this.stopRealtime();
    }
  }

  async handleFileSelect(file) {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.showMessage('error', '対応していないファイル形式です。JPG、PNG、GIF、WebPのファイルを選択してください。');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showMessage('error', 'ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。');
      return;
    }
    
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const img = document.getElementById('uploadPreview');
          img.src = e.target.result;
          img.onload = () => {
            document.getElementById('uploadPreviewContainer').classList.remove('hidden');
            document.getElementById('uploadResultsContainer').classList.add('hidden');
          };
        } catch (error) {
          this.showMessage('error', 'ファイルの読み込みに失敗しました: ' + error.message);
          console.error('File load error:', error);
        }
      };
      
      reader.onerror = (e) => {
        console.error('FileReader error:', e);
        this.showMessage('error', 'ファイルの読み込み中にエラーが発生しました。');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File handling error:', error);
      this.showMessage('error', 'ファイル処理中にエラーが発生しました: ' + error.message);
    }
  }

  async analyzeUploadedImage() {
    if (!this.isModelsLoaded) {
      this.showMessage('error', 'モデルが読み込まれていないため、表情分析ができません。ページを再読み込みして再試行してください。');
      return;
    }
    
    try {
      this.showLoading('画像を分析中...');
      
      const img = document.getElementById('uploadPreview');
      if (!img.src || img.src === '') {
        throw new Error('画像が選択されていません');
      }
      
      const canvas = document.getElementById('uploadCanvas');
      const ctx = canvas.getContext('2d');
      
      // Ensure image is loaded
      if (!img.complete) {
        await new Promise(resolve => {
          img.onload = resolve;
        });
      }
      
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('画像サイズが無効です');
      }
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Create an image element for faceapi (which works better with img elements)
      const faceImg = new Image();
      faceImg.src = canvas.toDataURL();
      
      await new Promise(resolve => {
        faceImg.onload = resolve;
      });
      
      const detections = await faceapi.detectAllFaces(faceImg, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      
      if (!detections || detections.length === 0) {
        this.hideLoading();
        this.showMessage('error', '顔が検出されませんでした。顔が写っている画像を選択してください。');
        return;
      }
      
      // Draw face detection boxes
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      const displaySize = { width: img.clientWidth, height: img.clientHeight };
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      
      // Show results
      this.displayEmotionResults(detections[0].expressions, 'uploadEmotionResults');
      this.createEmotionChart(detections[0].expressions, 'uploadChart');
      
      document.getElementById('uploadResultsContainer').classList.remove('hidden');
      this.hideLoading();
      this.showMessage('success', `${detections.length}個の顔を検出し、表情分析が完了しました。`);
      
    } catch (error) {
      this.hideLoading();
      console.error('Analysis error:', error);
      this.showMessage('error', '分析中にエラーが発生しました: ' + error.message);
    }
  }

  async startCamera() {
    try {
      this.showLoading('カメラを起動中...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('このブラウザはカメラ機能をサポートしていません。');
      }
      
      const constraints = { 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.currentStream = stream;
      const video = document.getElementById('cameraVideo');
      video.srcObject = stream;
      
      // Ensure video is properly loaded
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      
      await video.play();
      
      document.getElementById('cameraPlaceholder').classList.add('hidden');
      document.getElementById('cameraView').classList.remove('hidden');
      
      this.hideLoading();
      this.showMessage('success', 'カメラが正常に起動しました。');
      
    } catch (error) {
      this.hideLoading();
      console.error('Camera error:', error);
      
      let errorMessage = 'カメラの起動に失敗しました。';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラアクセスを許可してください。';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'カメラデバイスが見つかりません。';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'カメラにアクセスできません。他のアプリがカメラを使用している可能性があります。';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'このブラウザではカメラ機能がサポートされていません。';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'セキュリティエラーによりカメラにアクセスできません。HTTPS接続が必要な場合があります。';
      }
      
      this.showMessage('error', errorMessage);
    }
  }

  stopCamera() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => {
        track.stop();
      });
      this.currentStream = null;
      
      const video = document.getElementById('cameraVideo');
      if (video) {
        video.srcObject = null;
      }
    }
    
    document.getElementById('cameraPlaceholder').classList.remove('hidden');
    document.getElementById('cameraView').classList.add('hidden');
    document.getElementById('capturePreviewContainer').classList.add('hidden');
    document.getElementById('captureResultsContainer').classList.add('hidden');
  }

  takePicture() {
    try {
      const video = document.getElementById('cameraVideo');
      if (!video || !video.srcObject) {
        throw new Error('カメラが起動していません');
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('カメラのビデオサイズが無効です');
      }
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        const dataURL = canvas.toDataURL('image/png');
        const img = document.getElementById('capturePreview');
        img.src = dataURL;
        
        img.onload = () => {
          document.getElementById('capturePreviewContainer').classList.remove('hidden');
          document.getElementById('captureResultsContainer').classList.add('hidden');
        };
        
        this.showMessage('success', '写真が撮影されました。');
      } catch (dataURLError) {
        console.error('toDataURL error:', dataURLError);
        throw new Error('画像の生成に失敗しました');
      }
      
    } catch (error) {
      console.error('Capture error:', error);
      this.showMessage('error', '撮影に失敗しました: ' + error.message);
    }
  }

  async analyzeCapturedImage() {
    if (!this.isModelsLoaded) {
      this.showMessage('error', 'モデルが読み込まれていないため、表情分析ができません。ページを再読み込みして再試行してください。');
      return;
    }
    
    try {
      this.showLoading('画像を分析中...');
      
      const img = document.getElementById('capturePreview');
      if (!img.src || img.src === '') {
        throw new Error('画像が選択されていません');
      }
      
      const canvas = document.getElementById('captureCanvas');
      const ctx = canvas.getContext('2d');
      
      // Ensure image is loaded
      if (!img.complete) {
        await new Promise(resolve => {
          img.onload = resolve;
        });
      }
      
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('画像サイズが無効です');
      }
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Create an image element for faceapi (which works better with img elements)
      const faceImg = new Image();
      faceImg.src = canvas.toDataURL();
      
      await new Promise(resolve => {
        faceImg.onload = resolve;
      });
      
      const detections = await faceapi.detectAllFaces(faceImg, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      
      if (!detections || detections.length === 0) {
        this.hideLoading();
        this.showMessage('error', '顔が検出されませんでした。');
        return;
      }
      
      // Draw face detection boxes
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      const displaySize = { width: img.clientWidth, height: img.clientHeight };
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      
      // Show results
      this.displayEmotionResults(detections[0].expressions, 'captureEmotionResults');
      this.createEmotionChart(detections[0].expressions, 'captureChart');
      
      document.getElementById('captureResultsContainer').classList.remove('hidden');
      this.hideLoading();
      this.showMessage('success', `${detections.length}個の顔を検出し、表情分析が完了しました。`);
      
    } catch (error) {
      this.hideLoading();
      console.error('Analysis error:', error);
      this.showMessage('error', '分析中にエラーが発生しました: ' + error.message);
    }
  }

  async startRealtime() {
    if (!this.isModelsLoaded) {
      this.showMessage('error', 'モデルが読み込まれていないため、リアルタイム分析ができません。ページを再読み込みして再試行してください。');
      return;
    }
    
    try {
      this.showLoading('リアルタイム分析を開始中...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('このブラウザはカメラ機能をサポートしていません。');
      }
      
      const constraints = { 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.realtimeStream = stream;
      const video = document.getElementById('realtimeVideo');
      video.srcObject = stream;
      
      // Ensure video is properly loaded
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      
      await video.play();
      
      document.getElementById('realtimePlaceholder').classList.add('hidden');
      document.getElementById('realtimeView').classList.remove('hidden');
      
      // Initialize realtime chart
      this.initRealtimeChart();
      
      // Start analysis
      this.isRealtimeRunning = true;
      this.processRealtimeFrame(); // Initial call
      this.realtimeInterval = setInterval(() => this.processRealtimeFrame(), 1000);
      
      this.hideLoading();
      this.showMessage('success', 'リアルタイム分析を開始しました。');
      
    } catch (error) {
      this.hideLoading();
      console.error('Realtime error:', error);
      
      let errorMessage = 'リアルタイム分析の開始に失敗しました。';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラアクセスを許可してください。';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'カメラデバイスが見つかりません。';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'カメラにアクセスできません。他のアプリがカメラを使用している可能性があります。';
      }
      
      this.showMessage('error', errorMessage);
    }
  }

  stopRealtime() {
    this.isRealtimeRunning = false;
    
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
      this.realtimeInterval = null;
    }
    
    if (this.realtimeStream) {
      this.realtimeStream.getTracks().forEach(track => {
        track.stop();
      });
      this.realtimeStream = null;
      
      const video = document.getElementById('realtimeVideo');
      if (video) {
        video.srcObject = null;
      }
    }
    
    if (this.realtimeChart) {
      this.realtimeChart.destroy();
      this.realtimeChart = null;
    }
    
    document.getElementById('realtimePlaceholder').classList.remove('hidden');
    document.getElementById('realtimeView').classList.add('hidden');
    
    this.showMessage('success', 'リアルタイム分析を停止しました。');
  }

  async processRealtimeFrame() {
    if (!this.isRealtimeRunning) return;
    
    try {
      const video = document.getElementById('realtimeVideo');
      if (!video || !video.readyState || video.readyState < 2) {
        return; // Video not ready yet
      }
      
      const canvas = document.getElementById('realtimeCanvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      
      // Draw current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Create a snapshot for face-api to analyze
      const snapshot = document.createElement('canvas');
      snapshot.width = video.videoWidth;
      snapshot.height = video.videoHeight;
      snapshot.getContext('2d').drawImage(video, 0, 0, snapshot.width, snapshot.height);
      
      // Detect faces and expressions
      const detections = await faceapi.detectAllFaces(snapshot, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      
      if (detections && detections.length > 0) {
        const expressions = detections[0].expressions;
        const dominantEmotion = this.getDominantEmotion(expressions);
        
        // Update current emotion display
        const currentEmotionEl = document.getElementById('currentEmotion');
        const labelEl = currentEmotionEl.querySelector('.emotion-label');
        const scoreEl = currentEmotionEl.querySelector('.emotion-score');
        
        labelEl.textContent = dominantEmotion.name;
        scoreEl.textContent = `${(dominantEmotion.score * 100).toFixed(1)}%`;
        
        // Update chart
        if (this.realtimeChart) {
          const now = Date.now();
          this.emotions.forEach(emotion => {
            const score = expressions[emotion.key] || 0;
            this.realtimeChart.data.datasets.find(d => d.label === emotion.name).data.push({
              x: now,
              y: score * 100
            });
          });
          this.realtimeChart.update('none');
        }
        
        // Draw face detection
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
      } else {
        // No face detected
        const currentEmotionEl = document.getElementById('currentEmotion');
        const labelEl = currentEmotionEl.querySelector('.emotion-label');
        const scoreEl = currentEmotionEl.querySelector('.emotion-score');
        
        labelEl.textContent = '顔を検出中...';
        scoreEl.textContent = '';
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
    } catch (error) {
      console.error('Realtime processing error:', error);
      // Don't show error message to user for each frame error
      // Just log to console
    }
  }

  initRealtimeChart() {
    try {
      const ctx = document.getElementById('realtimeChart').getContext('2d');
      
      // Check if Chart.js and streaming plugin are available
      if (!window.Chart) {
        console.error('Chart.js not loaded');
        return;
      }
      
      // Configure datasets
      const datasets = this.emotions.map(emotion => ({
        label: emotion.name,
        data: [],
        borderColor: emotion.color,
        backgroundColor: emotion.color,
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 0
      }));
      
      // Create chart
      this.realtimeChart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 15,
                usePointStyle: true
              }
            },
            streaming: {
              duration: this.chartConfig.duration,
              refresh: this.chartConfig.refresh,
              delay: this.chartConfig.delay,
              frameRate: 30,
              pause: false
            }
          },
          scales: {
            x: {
              type: 'realtime',
              realtime: {
                duration: this.chartConfig.duration,
                refresh: this.chartConfig.refresh,
                delay: this.chartConfig.delay,
                onRefresh: function() {
                  // This is handled separately in processRealtimeFrame
                }
              },
              grid: {
                display: false
              }
            },
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: '確信度 (%)'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Chart initialization error:', error);
    }
  }

  getDominantEmotion(expressions) {
    let dominant = { name: '中立', score: 0, key: 'neutral' };
    
    if (!expressions) return dominant;
    
    this.emotions.forEach(emotion => {
      const score = expressions[emotion.key] || 0;
      if (score > dominant.score && score >= emotion.threshold) {
        dominant = { name: emotion.name, score, key: emotion.key };
      }
    });
    
    return dominant;
  }

  displayEmotionResults(expressions, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!expressions) return;
    
    this.emotions.forEach(emotion => {
      const score = expressions[emotion.key] || 0;
      const percentage = (score * 100).toFixed(1);
      
      const item = document.createElement('div');
      item.className = 'emotion-item';
      item.style.borderLeftColor = emotion.color;
      
      item.innerHTML = `
        <div class="emotion-name">${emotion.name}</div>
        <div class="emotion-score">${percentage}%</div>
      `;
      
      container.appendChild(item);
    });
  }

  createEmotionChart(expressions, canvasId) {
    try {
      const ctx = document.getElementById(canvasId).getContext('2d');
      
      if (!expressions) return;
      
      const data = this.emotions.map(emotion => ({
        label: emotion.name,
        value: (expressions[emotion.key] || 0) * 100,
        color: emotion.color
      }));
      
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            data: data.map(d => d.value),
            backgroundColor: data.map(d => d.color),
            borderColor: data.map(d => d.color),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: '確信度 (%)'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Chart creation error:', error);
    }
  }

  resetUpload() {
    document.getElementById('uploadPreviewContainer').classList.add('hidden');
    document.getElementById('uploadResultsContainer').classList.add('hidden');
    document.getElementById('fileInput').value = '';
  }

  resetCapture() {
    document.getElementById('capturePreviewContainer').classList.add('hidden');
    document.getElementById('captureResultsContainer').classList.add('hidden');
  }

  showLoading(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  showMessage(type, text) {
    try {
      const overlay = document.getElementById('messageOverlay');
      const messageText = document.getElementById('messageText');
      const successIcon = overlay.querySelector('.icon-success');
      const errorIcon = overlay.querySelector('.icon-error');
      
      messageText.textContent = text;
      
      if (type === 'success') {
        successIcon.classList.remove('hidden');
        errorIcon.classList.add('hidden');
      } else {
        successIcon.classList.add('hidden');
        errorIcon.classList.remove('hidden');
      }
      
      overlay.classList.remove('hidden');
      
      // Make sure the close button works
      const closeBtn = document.getElementById('messageCloseBtn');
      if (closeBtn) {
        // Remove any existing event listeners and add a new one
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => this.hideMessage());
      }
    } catch (error) {
      console.error('Error showing message:', error);
    }
  }

  hideMessage() {
    document.getElementById('messageOverlay').classList.add('hidden');
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.qbhApp = new QBHFERApp();
});