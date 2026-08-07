// services/lineService.js
const axios = require('axios');
require('dotenv').config();

async function sendDoctorAlert(analysisResult, fhirId) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    // 如果沒有 Token，只印出 Log (方便測試)
    if (!token) {
        console.log("⚠️ [模擬 LINE 通知]：發現高風險病人！分數：", analysisResult.urgency_score);
        return;
    }

    const message = {
        to: "YOUR_DOCTOR_USER_ID", // 實際應用需從資料庫讀取醫生 ID
        messages: [{
            type: "flex",
            altText: "緊急病人通知",
            contents: {
                type: "bubble",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "🚨 高風險警報", weight: "bold", color: "#FF0000" }]
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: `急迫性分數: ${analysisResult.urgency_score}/10` },
                        { type: "text", text: `摘要: ${analysisResult.summary}`, wrap: true }
                    ]
                }
            }
        }]
    };

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', message, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("[LINE] 通知已發送");
    } catch (error) {
        console.error("[LINE] 發送失敗:", error.response?.data || error.message);
    }
}

module.exports = { sendDoctorAlert };