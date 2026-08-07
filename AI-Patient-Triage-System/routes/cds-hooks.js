const express = require('express');
const axios = require('axios'); // 記得確認有無安裝 axios
const router = express.Router();
require('dotenv').config();

const FHIR_URL = process.env.FHIR_BASE_URL; // http://hapi.fhir.org/baseR4

// 👇 補上這段：CDS Hooks Discovery Endpoint
router.get('/', (req, res) => {
    res.json({
        services: [
            {
                hook: "patient-view", // 觸發時機：通常 triage 評估是在進入病歷畫面時觸發
                id: "patient-triage-service", // ⚠️ 重要：這裡必須與下方 POST 的路徑一致
                title: "AI 智能檢傷與初步評估系統",
                description: "分析病患症狀與情緒，自動生成檢傷建議與處置優先級別。",
                prefetch: {
                    patient: "Patient/{{context.patientId}}" // 若需要 EHR 預先抓取病人資料可寫在這裡
                }
            }
        ]
    });
});
// 👆 結束

// Service Endpoint: patient-view
router.post('/patient-triage-service', async (req, res) => {
    const context = req.body.context || {};
    const patientId = context.patientId;

    if (!patientId) {
        return res.status(400).json({ error: "Missing patientId" });
    }

    console.log(`[CDS Hook] 醫師正在查看病人: ${patientId}`);

    let cards = [];

    try {
        const fhirRes = await axios.get(`${FHIR_URL}/Observation`, {
            params: {
                subject: `Patient/${patientId}`,
                code: 'http://loinc.org|80615-8', // Axios 會自動轉成 %7C
                _sort: '-date',
                _count: 1
            },
            headers: {
                'Accept': 'application/fhir+json' // 確保告訴 Server 我們要 JSON
            }
        });

        if (fhirRes.data.entry && fhirRes.data.entry.length > 0) {
            const observation = fhirRes.data.entry[0].resource;

            // 2. 解析 FHIR 資料 (還原回原本的數據)
            const urgencyScore = observation.valueQuantity ? observation.valueQuantity.value : 0;
            const notes = observation.note || [];
            const summaryNote = notes.find(n => n.text.startsWith("AI Summary:"))?.text || "無摘要";
            const symptomsNote = notes.find(n => n.text.startsWith("Symptoms:"))?.text || "";

            console.log(`[CDS Hook] 找到最新評估，分數: ${urgencyScore}`);

            // 3. 判斷是否需要跳出卡片 (例如分數 >= 5 才跳)
            if (urgencyScore >= 5) {
                cards.push({
                    summary: `🚨 高風險警示 (分數: ${urgencyScore})`,
                    indicator: urgencyScore >= 8 ? "critical" : "warning",
                    source: {
                        label: "AI Triage System",
                        topic: {
                            system: "http://loinc.org",
                            code: "80615-8"
                        }
                    },
                    detail: `${summaryNote}\n${symptomsNote}\n(資料來源: 病人最新自述)`
                });
            } else {
                // 低風險也可以選擇跳一個安心卡，或不跳(空陣列)
                cards.push({
                    summary: "✅病人狀況穩定",
                    indicator: "info",
                    detail: "最新 AI 評估顯示無異常。",
                    source: { label: "AI Triage System" }
                });
            }
        } else {
            console.log("[CDS Hook] 查無該病人的 AI 評估資料");
        }

    } catch (error) {
        console.error("FHIR 查詢錯誤:", error.message);
    }

    // 回傳 CDS Cards JSON
    res.json({ cards });
});
// 🌟 關鍵就在這裡：把設定好的 router 導出，讓主程式可以使用
module.exports = router;