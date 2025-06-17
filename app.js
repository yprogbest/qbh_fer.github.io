// Application data from JSON
const appData = {
  "emotions": ["喜び", "悲しみ", "怒り", "驚き", "恐怖", "嫌悪", "軽蔑", "中立"],
  "chartColors": {
    "喜び": "#ff6384",
    "悲しみ": "#36a2eb", 
    "怒り": "#ff9f40",
    "驚き": "#4bc0c0",
    "恐怖": "#9966ff",
    "嫌悪": "#c9cbcf",
    "軽蔑": "#ff6384",
    "中立": "#36a2eb"
  },
  "systemConfig": {
    "updateInterval": 1000,
    "historyDuration": 30000,
    "confidenceThreshold": 0.5,
    "maxDataPoints": 30
  },
  "quantumFeatures": {
    "dimensions": [256, 512, 768],
    "correlationRange": [0.7, 1.0],
    "superpositionRange": [0.6, 1.0]
  },
  "neuromorphicMetrics": {
    "spikeFrequencyRange": [100, 200],
    "powerReductionRange": [70, 90],
    "efficiencyRange": [200, 300]
  }
};

// Global variables
let emotionChart = null;
let realtimeInterval = null;
let cameraStream = null;
let isRealtimeActive = false;
let frameCount = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initTabNavigation();
  initUploadFunctionality();
  initCameraFunctionality();
  initRealtimeFunctionality();
});

// Tab Navigation
function initTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      button.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// Upload Functionality
function initUploadFunctionality() {
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
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processUploadedImage(files[0]);
    }
  });
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processUploadedImage(e.target.files[0]);
    }
  });
}

// Camera Functionality
function initCameraFunctionality() {
  const startBtn = document.getElementById('start-camera');
  const captureBtn = document.getElementById('capture-photo');
  const stopBtn = document.getElementById('stop-camera');
  const video = document.getElementById('camera-video');
  
  startBtn.addEventListener('click', startCamera);
  captureBtn.addEventListener('click', capturePhoto);
  stopBtn.addEventListener('click', stopCamera);
}

// Real-time Functionality
function initRealtimeFunctionality() {
  const startBtn = document.getElementById('start-realtime');
  const pauseBtn = document.getElementById('pause-realtime');
  const clearBtn = document.getElementById('clear-data');
  
  startBtn.addEventListener('click', startRealtimeAnalysis);
  pauseBtn.addEventListener('click', pauseRealtimeAnalysis);
  clearBtn.addEventListener('click', clearChartData);
  
  initEmotionChart();
}

// Initialize Chart.js with simpler configuration
function initEmotionChart() {
  const ctx = document.getElementById('emotion-chart').getContext('2d');
  
  const datasets = appData.emotions.map(emotion => ({
    label: emotion,
    borderColor: appData.chartColors[emotion],
    backgroundColor: appData.chartColors[emotion] + '20',
    data: [],
    fill: false,
    tension: 0.4,
    pointRadius: 2
  }));

  emotionChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          title: {
            display: true,
            text: '時間 (秒)'
          }
        },
        y: {
          beginAtZero: true,
          max: 1,
          title: {
            display: true,
            text: '感情強度'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  });
}

// Process uploaded image
function processUploadedImage(file) {
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください。');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    analyzeImage(e.target.result, 'upload');
  };
  reader.readAsDataURL(file);
}

// Start camera
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480 } 
    });
    
    const video = document.getElementById('camera-video');
    video.srcObject = cameraStream;
    
    document.getElementById('start-camera').style.display = 'none';
    document.getElementById('capture-photo').style.display = 'inline-flex';
    document.getElementById('stop-camera').style.display = 'inline-flex';
  } catch (error) {
    alert('カメラアクセスに失敗しました: ' + error.message);
  }
}

// Capture photo
function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  
  const imageData = canvas.toDataURL('image/jpeg');
  analyzeImage(imageData, 'camera');
}

// Stop camera
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  document.getElementById('start-camera').style.display = 'inline-flex';
  document.getElementById('capture-photo').style.display = 'none';
  document.getElementById('stop-camera').style.display = 'none';
}

// Start real-time analysis with simplified approach
function startRealtimeAnalysis() {
  if (isRealtimeActive) return;
  
  // Start without camera for demonstration purposes
  isRealtimeActive = true;
  frameCount = 0;
  
  document.getElementById('start-realtime').style.display = 'none';
  document.getElementById('pause-realtime').style.display = 'inline-flex';
  
  // Start the data generation interval
  const startTime = Date.now();
  realtimeInterval = setInterval(() => {
    if (isRealtimeActive) {
      const currentTime = (Date.now() - startTime) / 1000; // Convert to seconds
      updateRealtimeData(currentTime);
      frameCount++;
      updateFrameCount();
    }
  }, appData.systemConfig.updateInterval);
  
  // Initial update
  updateRealtimeData(0);
}

// Pause real-time analysis
function pauseRealtimeAnalysis() {
  isRealtimeActive = false;
  
  if (realtimeInterval) {
    clearInterval(realtimeInterval);
    realtimeInterval = null;
  }
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  document.getElementById('start-realtime').style.display = 'inline-flex';
  document.getElementById('pause-realtime').style.display = 'none';
}

// Clear chart data
function clearChartData() {
  emotionChart.data.datasets.forEach(dataset => {
    dataset.data = [];
  });
  emotionChart.update();
  
  frameCount = 0;
  updateStatistics('中立', 0);
  updateQuantumMetrics();
  updateFrameCount();
}

// Update real-time data for chart
function updateRealtimeData(currentTime) {
  const emotionData = generateEmotionData();
  
  emotionChart.data.datasets.forEach((dataset, index) => {
    const emotion = appData.emotions[index];
    const value = emotionData.emotions[emotion] || 0;
    
    dataset.data.push({
      x: currentTime,
      y: value
    });
    
    // Keep only last 30 data points
    if (dataset.data.length > appData.systemConfig.maxDataPoints) {
      dataset.data.shift();
    }
  });
  
  emotionChart.update('none'); // Update without animation for better performance
  
  const primaryEmotion = getPrimaryEmotion(emotionData.emotions);
  const confidence = emotionData.confidence;
  
  updateStatistics(primaryEmotion, confidence);
  updateQuantumMetrics();
}

// Analyze image (simulation)
function analyzeImage(imageData, mode) {
  const emotionData = generateEmotionData();
  displayEmotionResults(emotionData, mode);
}

// Generate simulated emotion data with more realistic patterns
function generateEmotionData() {
  const emotions = {};
  
  // Create more realistic emotion patterns
  const time = Date.now() / 1000;
  const baseNoise = 0.1;
  
  appData.emotions.forEach((emotion, index) => {
    // Use sine waves with different frequencies and phases for each emotion
    const frequency = 0.1 + (index * 0.05);
    const phase = index * Math.PI / 4;
    const amplitude = 0.3 + Math.random() * 0.4;
    
    let value = amplitude * Math.sin(frequency * time + phase) + 0.5;
    value += (Math.random() - 0.5) * baseNoise; // Add noise
    value = Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
    
    emotions[emotion] = value;
  });
  
  // Ensure one emotion is somewhat dominant
  const dominantIndex = Math.floor(time / 5) % appData.emotions.length;
  const dominantEmotion = appData.emotions[dominantIndex];
  emotions[dominantEmotion] = Math.min(1, emotions[dominantEmotion] * 1.5);
  
  return {
    emotions,
    confidence: 0.6 + Math.random() * 0.35,
    timestamp: Date.now()
  };
}

// Display emotion results
function displayEmotionResults(data, mode) {
  const container = document.getElementById(`${mode}-emotions`);
  const metricsContainer = document.getElementById(`${mode}-metrics`);
  
  container.innerHTML = '';
  
  Object.entries(data.emotions).forEach(([emotion, value]) => {
    const bar = document.createElement('div');
    bar.className = 'emotion-bar';
    
    bar.innerHTML = `
      <div class="emotion-label">${emotion}</div>
      <div class="emotion-progress">
        <div class="emotion-fill" style="width: ${value * 100}%; background-color: ${appData.chartColors[emotion]};"></div>
      </div>
      <div class="emotion-value">${(value * 100).toFixed(1)}%</div>
    `;
    
    container.appendChild(bar);
  });
  
  // Update quantum metrics
  metricsContainer.innerHTML = `
    <div class="quantum-metric">
      <label>量子相関係数</label>
      <div class="metric-value">${(0.7 + Math.random() * 0.3).toFixed(3)}</div>
    </div>
    <div class="quantum-metric">
      <label>重ね合わせ状態</label>
      <div class="metric-value">${(0.6 + Math.random() * 0.4).toFixed(3)}</div>
    </div>
    <div class="quantum-metric">
      <label>処理効率</label>
      <div class="metric-value">${(200 + Math.random() * 100).toFixed(0)}%</div>
    </div>
  `;
  
  document.getElementById(`${mode}-result`).style.display = 'block';
}

// Get primary emotion
function getPrimaryEmotion(emotions) {
  let maxValue = 0;
  let primaryEmotion = '中立';
  
  Object.entries(emotions).forEach(([emotion, value]) => {
    if (value > maxValue) {
      maxValue = value;
      primaryEmotion = emotion;
    }
  });
  
  return primaryEmotion;
}

// Update statistics display
function updateStatistics(primaryEmotion, confidence) {
  document.getElementById('primary-emotion').textContent = primaryEmotion;
  document.getElementById('confidence-value').textContent = `${(confidence * 100).toFixed(1)}%`;
}

// Update quantum metrics
function updateQuantumMetrics() {
  const correlation = appData.quantumFeatures.correlationRange[0] + 
    Math.random() * (appData.quantumFeatures.correlationRange[1] - appData.quantumFeatures.correlationRange[0]);
  
  const superposition = appData.quantumFeatures.superpositionRange[0] + 
    Math.random() * (appData.quantumFeatures.superpositionRange[1] - appData.quantumFeatures.superpositionRange[0]);
  
  const spikeFreq = appData.neuromorphicMetrics.spikeFrequencyRange[0] + 
    Math.random() * (appData.neuromorphicMetrics.spikeFrequencyRange[1] - appData.neuromorphicMetrics.spikeFrequencyRange[0]);
  
  const powerReduction = appData.neuromorphicMetrics.powerReductionRange[0] + 
    Math.random() * (appData.neuromorphicMetrics.powerReductionRange[1] - appData.neuromorphicMetrics.powerReductionRange[0]);
  
  document.getElementById('quantum-correlation').textContent = correlation.toFixed(3);
  document.getElementById('superposition').textContent = superposition.toFixed(3);
  document.getElementById('spike-frequency').textContent = `${spikeFreq.toFixed(0)} Hz`;
  document.getElementById('power-reduction').textContent = `${powerReduction.toFixed(1)}%`;
}

// Update frame count
function updateFrameCount() {
  document.getElementById('frame-count').textContent = frameCount.toString();
}

// Handle window unload
window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
  if (realtimeInterval) {
    clearInterval(realtimeInterval);
  }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRealtimeActive) {
    pauseRealtimeAnalysis();
  }
});