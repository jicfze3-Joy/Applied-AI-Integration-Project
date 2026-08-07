<script setup>
import { ref } from 'vue';
import axios from 'axios';

// --- 狀態變數 ---
const patientName = ref('');
const patientHeight = ref('');
const patientWeight = ref('');
const patientText = ref('');

const result = ref(null);
const loading = ref(false);
const errorMsg = ref('');

// --- 設定後端 API 位址 ---
const API_URL = 'https://applied-ai-backend-h71g.onrender.com/api/triage/analyze';

// --- 發送分析請求 ---
const submitTriage = async () => {
  // 表單驗證
  if (!patientName.value.trim() || !patientHeight.value || !patientWeight.value) {
    alert("請完整填寫姓名、身高與體重");
    return;
  }
  if (!patientText.value.trim()) {
    alert("請輸入您目前減肥的狀況");
    return;
  }

  loading.value = true;
  errorMsg.value = '';
  result.value = null;

  try {
    const payload = {
      patientName: patientName.value,
      patientHeight: Number(patientHeight.value),
      patientWeight: Number(patientWeight.value),
      patientText: patientText.value,
      patientId: "137200242" // 實際專案應從登入資訊取得
    };

    const response = await axios.post(API_URL, payload);
    result.value = response.data;

    if (result.value.doctor_notified) {
      alert("🚨 系統偵測到體重高風險！已同步發送 LINE 通知給您的主治醫師。");
    }

  } catch (err) {
    console.error(err);
    errorMsg.value = "連線失敗，請確認後端伺服器是否已啟動。";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="container">
    <div class="card">
      <h1>🏋️‍♀️ 自我減肥進度回報 (AI Triage)</h1>
      <p class="subtitle">請輸入您的基本生理數據與近期減肥狀況</p>

      <!-- 新增：生理數據輸入區塊 -->
      <div class="input-row">
        <div class="input-group">
          <label class="form-label">姓名</label>
          <input v-model="patientName" type="text" placeholder="請輸入姓名" />
        </div>
        <div class="input-group">
          <label class="form-label">身高 (cm)</label>
          <input v-model="patientHeight" type="number" step="0.1" placeholder="例如：175" />
        </div>
        <div class="input-group">
          <label class="form-label">體重 (kg)</label>
          <input v-model="patientWeight" type="number" step="0.1" placeholder="例如：85" />
        </div>
      </div>

      <div class="input-group">
        <label class="form-label">近期減肥狀況描述</label>
        <textarea 
          v-model="patientText" 
          placeholder="請用自然語言描述，例如：最近感到很暴飲暴食，體重一直降不下來，睡眠也很差..."
          rows="4"
        ></textarea>
      </div>

      <button @click="submitTriage" :disabled="loading" class="submit-btn">
        {{ loading ? '🏊‍♂️ AI 醫學分析中...' : '送出評估' }}
      </button>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <div v-if="result" class="result-box" :class="{ critical: result.data.urgency_score >= 8 }">
        <h3>📝 分析報告</h3>
        
        <!-- 新增：呈現 AI 計算出來的醫學指標 -->
        <div class="patient-info-summary" v-if="result.data.calculated_bmi">
          病人：<strong>{{ patientName }}</strong> | 
          計算 BMI：<strong class="bmi-highlight">{{ result.data.calculated_bmi }}</strong> 
          ({{ result.data.weight_status }})
        </div>

        <div class="stat-row">
          <span class="label">急迫性分數 (1-10):</span>
          <span class="value score">{{ result.data.urgency_score }}</span>
        </div>

        <div class="stat-row">
          <span class="label">核心情緒:</span>
          <span class="value">{{ result.data.emotion }}</span>
        </div>

        <div class="stat-row">
          <span class="label">生理與心理異常症狀:</span>
          <span class="value badge-container">
            <span v-for="symptom in result.data.symptoms" :key="symptom" class="symptom-badge">
              {{ symptom }}
            </span>
          </span>
        </div>

        <div class="stat-row">
          <span class="label">醫師摘要:</span>
          <p class="summary-text">{{ result.data.summary }}</p>
        </div>

        <div class="stat-row" v-if="result.fhir_reference">
          <small class="fhir-link">FHIR ID: {{ result.fhir_reference }} (已存檔)</small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 650px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
.card {
  background: #ffffff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
h1 { color: #2c3e50; margin-bottom: 0.5rem; text-align: center;}
.subtitle { color: #7f8c8d; text-align: center; margin-bottom: 1.5rem; }

/* 欄位布局 */
.input-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
.input-row .input-group {
  flex: 1;
}
.input-group {
  margin-bottom: 1rem;
}
.form-label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.4rem;
  color: #34495e;
  font-size: 0.9rem;
}
input[type="text"], input[type="number"], textarea {
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #ecf0f1;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box; 
}
input:focus, textarea:focus {
  border-color: #3498db;
  outline: none;
}

.submit-btn {
  width: 100%;
  padding: 1rem;
  margin-top: 1rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.3s;
}
.submit-btn:hover { background-color: #2980b9; }
.submit-btn:disabled { background-color: #bdc3c7; cursor: not-allowed; }

.error { color: #e74c3c; text-align: center; margin-top: 1rem; }

/* 結果卡片 */
.result-box {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 5px solid #2ecc71;
}
.result-box.critical {
  background-color: #fff5f5;
  border-left: 5px solid #e74c3c;
}
.patient-info-summary {
  background: #edf2f7;
  padding: 0.6rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}
.bmi-highlight { color: #e74c3c; }
.stat-row { margin-bottom: 1rem; }
.label { font-weight: bold; color: #34495e; display: block; margin-bottom: 0.2rem; }
.value { color: #2c3e50; }
.score { font-size: 1.5rem; font-weight: bold; color: #e67e22; }
.summary-text { background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #eee; margin: 0.3rem 0 0 0;}

/* 症狀標籤 */
.badge-container { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.3rem; }
.symptom-badge {
  background: #e2e8f0;
  color: #4a5568;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.85rem;
}
</style>
