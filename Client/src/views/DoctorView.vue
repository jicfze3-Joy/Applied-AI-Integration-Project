<template>
  <div class="ehr-container">
    <header class="ehr-header">
      <div class="header-content">
        <h1>🩺 醫師看診視圖 (EHR Dashboard)</h1>
        <p>臨床決策支援系統 (CDS Hooks) 整合展示</p>
      </div>
    </header>

    <main class="ehr-main">
      <div class="patient-selection">
        <label for="patient-id">輸入病人 ID：</label>
        <input 
          id="patient-id" 
          v-model="patientId" 
          type="text" 
          placeholder="例如: 131367607" 
          @keyup.enter="getPatientRecord(patientId)"
        />
        <button @click="getPatientRecord(patientId)" :disabled="loading">
          {{ loading ? '讀取中...' : '讀取病人病歷' }}
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="patientData" class="patient-record">
        <h2>📄 病人基本資料</h2>
        <div class="record-details">
          <p><strong>FHIR ID：</strong> {{ patientData.id }}</p>
          <p><strong>姓名：</strong> {{ patientData.name }}</p>
          <p><strong>性別：</strong> {{ patientData.gender }}</p>
          <p><strong>出生日期：</strong> {{ patientData.birthDate }}</p>
        </div>
      </div>

      <div v-if="cdsCards.length > 0" class="cds-cards">
        <h2>💡 臨床決策建議 (CDS Cards)</h2>
        <div 
          v-for="(card, index) in cdsCards" 
          :key="index" 
          class="card" 
          :class="card.indicator"
        >
          <h3>{{ card.summary }}</h3>
          <p>{{ card.detail }}</p>
          <a v-if="card.source && card.source.url" :href="card.source.url" target="_blank" class="source-link">
            參考資料: {{ card.source.label }}
          </a>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 狀態管理
const patientId = ref(''); 
const patientData = ref(null);
const cdsCards = ref([]);
const availableServices = ref([]);
const loading = ref(false);
const error = ref(null);

// 你的 CDS Hooks Server 網址 (請依據你的專案設定修改)
const CDS_SERVER_URL = 'http://localhost:3000/cds-services';
// 公開的 FHIR 測試伺服器
const FHIR_SERVER_URL = 'https://hapi.fhir.org/baseR4';

// ==========================================
// 1. 系統初始化階段 (Discovery GET)
// ==========================================
onMounted(async () => {
  try {
    const response = await fetch(CDS_SERVER_URL);
    if (!response.ok) throw new Error('無法取得 CDS 服務清單');
    
    const data = await response.json();
    availableServices.value = data.services || [];
    console.log('✅ 成功載入 CDS 服務清單:', availableServices.value);
  } catch (err) {
    console.error('Discovery GET 失敗:', err);
    error.value = '無法連接到 CDS Server，請確認後端是否已啟動。';
  }
});

// ==========================================
// 2. 使用者操作階段 (觸發 Service POST)
// ==========================================
const getPatientRecord = async (id) => {
  if (!id) {
    error.value = '請輸入病人 ID';
    return;
  }
  
  loading.value = true;
  error.value = null;
  patientData.value = null;
  cdsCards.value = [];

  try {
    // [步驟 A]：真實去 FHIR Server 取得病人資料
    console.log(`正在向 FHIR Server 請求病人資料: ${FHIR_SERVER_URL}/Patient/${id}`);
    const fhirResponse = await fetch(`${FHIR_SERVER_URL}/Patient/${id}`);
    
    if (!fhirResponse.ok) {
      if (fhirResponse.status === 404) throw new Error('在 FHIR Server 上找不到此 ID 的病人');
      throw new Error(`無法取得病人資料，HTTP 狀態碼: ${fhirResponse.status}`);
    }
    
    const fhirPatient = await fhirResponse.json();

    // 解析 FHIR 格式的資料，對應到畫面要顯示的結構
    const patientNameData = fhirPatient.name?.[0];
    const patientName = patientNameData?.text || 
                       `${patientNameData?.family || ''} ${patientNameData?.given?.join(' ') || ''}`.trim() || 
                       '無姓名資料';

    const genderMap = { 'male': '男', 'female': '女', 'other': '其他', 'unknown': '未知' };

    patientData.value = {
      id: fhirPatient.id,
      name: patientName,
      gender: genderMap[fhirPatient.gender] || fhirPatient.gender || '無性別資料',
      birthDate: fhirPatient.birthDate || '無生日紀錄'
    };

    // [步驟 B]：觸發 CDS Hooks (patient-view)
    const patientViewServices = availableServices.value.filter(s => s.hook === 'patient-view');
    
    if (patientViewServices.length > 0) {
      const requestBody = {
        hook: 'patient-view',
        hookInstance: crypto.randomUUID(),
        context: {
          userId: 'Practitioner/example-doctor', 
          patientId: id, 
        },
        // 透過 prefetch 將剛查到的 FHIR 病人資料帶給 CDS 服務
        prefetch: {
          patientToGreet: fhirPatient
        }
      };

      for (const service of patientViewServices) {
        const serviceUrl = `${CDS_SERVER_URL}/${service.id}`;

        const cdsResponse = await fetch(serviceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (cdsResponse.ok) {
          const result = await cdsResponse.json();
          if (result && result.cards) {
            cdsCards.value.push(...result.cards);
          }
        } else {
          console.warn(`呼叫 CDS 服務 ${service.id} 失敗:`, cdsResponse.status);
        }
      }
    } else {
      console.log('目前沒有註冊 patient-view 的 CDS 服務');
    }

  } catch (err) {
    console.error('取得病歷或呼叫 CDS 發生錯誤:', err);
    error.value = '發生錯誤：' + err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.ehr-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.ehr-header {
  background-color: #f4f6f8;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 5px solid #2c3e50;
}

.ehr-header h1 {
  margin: 0 0 10px 0;
  font-size: 1.5rem;
  color: #2c3e50;
}

.patient-selection {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.patient-selection input {
  padding: 10px;
  margin: 0 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 200px;
}

.patient-selection button {
  padding: 10px 20px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.patient-selection button:disabled {
  background-color: #a0d8bf;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  background-color: #f8d7da;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.patient-record {
  background-color: #fff;
  border: 1px solid #e1e4e8;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.record-details p {
  margin: 8px 0;
  font-size: 1.1em;
}

.cds-cards h2 {
  color: #d35400;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}

.card {
  background: white;
  border: 1px solid #ddd;
  border-left: 6px solid #6c757d;
  padding: 20px;
  margin-bottom: 15px;
  border-radius: 6px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.card h3 {
  margin-top: 0;
}

.card.info { border-left-color: #17a2b8; }
.card.warning { border-left-color: #ffc107; }
.card.critical { border-left-color: #dc3545; }

.source-link {
  display: inline-block;
  margin-top: 10px;
  color: #007bff;
  text-decoration: none;
  font-size: 0.9em;
}

.source-link:hover {
  text-decoration: underline;
}
</style>