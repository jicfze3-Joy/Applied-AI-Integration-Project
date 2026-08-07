// routes/triage.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { analyzePatientFeedback } = require('../services/aiService');
const { saveToFHIR } = require('../services/fhirService');
const { sendDoctorAlert } = require('../services/lineService');

const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir';

// POST /api/triage/analyze
router.post('/analyze', async (req, res) => {
    // 1. 接收前端傳來的資料
    const { patientText, patientName, patientHeight, patientWeight } = req.body;

    if (!patientText) {
        return res.status(400).json({ error: "請輸入內容" });
    }

    // 2. 🚨 固定病人 ID 為 137258849
    const TARGET_PATIENT_ID = "137258849"; 
    const inputName = patientName ? patientName.trim() : '路小肥';

    console.log(`\n--- 收到病人 [${inputName}] 回饋 (系統強制指定 ID: ${TARGET_PATIENT_ID}) ---`);

    // 3. 🚨 強制更新 HAPI FHIR 上的 Patient 姓名欄位
    try {
        console.log(`[FHIR] 正在精準覆蓋 Patient/${TARGET_PATIENT_ID} 的姓名欄位...`);
        
        // 切分姓與名，完美應對 HAPI FHIR 的 family 與 given 結構
        const lastName = inputName.substring(0, 1);       // 姓 (例如: 路)
        const firstName = inputName.substring(1);        // 名 (例如: 小肥)

        const updatedPatient = {
            resourceType: "Patient",
            id: TARGET_PATIENT_ID,
            active: true,
            // 💡 精準複寫結構，徹底洗掉原本的 David WANG
            name: [{
                use: "official",
                text: inputName,
                family: lastName,
                given: [firstName]
            }],
            gender: "female",          // 保持原有資料不變
            birthDate: "1995-01-25",   // 保持原有資料不變
            identifier: [{             // 保持原有識別碼不變
                use: "official",
                type: {
                    coding: [{
                        system: "http://hl7.org",
                        code: "MR",
                        display: "Medical Record Number"
                    }],
                    text: "MRN"
                },
                system: "http://example.org",
                value: "903557691"
            }]
        };

        // 發送 PUT 請求更新病人基礎檔
        await axios.put(`${FHIR_BASE_URL}/Patient/${TARGET_PATIENT_ID}`, updatedPatient, {
            headers: { 'Content-Type': 'application/fhir+json' }
        });
        console.log(`[FHIR] 成功！Patient/${TARGET_PATIENT_ID} 姓名已更新為 [${inputName}] (姓: ${lastName}, 名: ${firstName})`);
        
    } catch (fhirPatientError) {
        console.error("❌ [FHIR Patient Override Error] 覆蓋病人姓名失敗:", fhirPatientError.message);
        // 即使病人基本資料更新受阻，也繼續往下走，不影響核心 AI 分析與報告儲存
    }

    // 4. 將參數傳給 AI 服務進行 BMI 計算與減重醫學評估
    const aiResult = await analyzePatientFeedback(patientText, inputName, patientHeight, patientWeight);
    console.log("AI 分析結果:", aiResult);

    // 5. 將評估報告（Observation）存入 FHIR，並正確綁定在 TARGET_PATIENT_ID 上
    const fhirObservationId = await saveToFHIR(aiResult, TARGET_PATIENT_ID, inputName);

    // 6. 判斷是否需要通知醫生 (分數 >= 8 或 需要介入)
    let alertSent = false;
    if (aiResult.urgency_score >= 8 || aiResult.needs_human_intervention) {
        try {
            await sendDoctorAlert(aiResult, fhirObservationId);
            alertSent = true;
        } catch (lineError) {
            console.error("❌ [LINE Alert Error] LINE 通知發送失敗，但不阻斷主流程。");
        }
    }

    // 7. 回傳結果給前端 Vue
    res.json({
        success: true,
        data: aiResult,
        fhir_reference: fhirObservationId,
        doctor_notified: alertSent
    });
});

module.exports = router;
