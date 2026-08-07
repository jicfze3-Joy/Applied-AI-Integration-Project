// services/fhirService.js
const axios = require('axios');
require('dotenv').config();

async function saveToFHIR(analysisResult, patientId) {
    const fhirUrl = process.env.FHIR_BASE_URL;

    const observation = {
        resourceType: "Observation",
        status: "final",
        code: {
            coding: [{ system: "http://loinc.org", code: "80615-8", display: "Patient Emotion & Urgency" }],
            text: analysisResult.emotion
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: {
            value: analysisResult.urgency_score,
            unit: "score",
            system: "http://unitsofmeasure.org",
            code: "{score}"
        },
        note: [
            { text: `AI Summary: ${analysisResult.summary}` },
            { text: `Symptoms: ${analysisResult.symptoms.join(', ')}` }
        ]
    };

    try {
        const response = await axios.post(`${fhirUrl}/Observation`, observation, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[FHIR] 資料已存檔，ID: ${response.data.id}`);
        return response.data.id;
    } catch (error) {
        if (error.response) {
            // 伺服器有回應，但狀態碼不在 2xx 範圍內
            console.error("[FHIR] 上傳失敗 - 伺服器回應:");
            console.error("狀態碼 (Status):", error.response.status);
            
            // 這是最關鍵的部分，FHIR 的錯誤細節都在這裡
            // 使用 JSON.stringify 讓輸出的物件排版易讀
            console.error("錯誤內容 (Body):", JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // 請求已發出，但沒有收到回應 (例如網路斷線、伺服器掛掉連不上)
            console.error("[FHIR] 上傳失敗 - 無回應 (Network Error):", error.message);
        } else {
            // 設定請求時發生錯誤
            console.error("[FHIR] 上傳失敗 - 請求設定錯誤:", error.message);
        }
        return null;
    }
}

module.exports = { saveToFHIR };