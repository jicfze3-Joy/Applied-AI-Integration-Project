require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 初始化 Google AI 實例
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 分析病人的體重與減肥進度主訴
 * @param {string} patientText 自然語言主訴
 * @param {string} patientName 病人姓名
 * @param {number|string} patientHeight 身高 (cm)
 * @param {number|string} patientWeight 體重 (kg)
 * @returns {Object} 結構化的醫學評估 JSON 結果
 */
async function analyzePatientFeedback(patientText, patientName, patientHeight, patientWeight) {
    try {
        // 1. 基本參數防呆驗證
        const name = patientName ? patientName.trim() : '未知名學員';
        const height = patientHeight || '未提供';
        const weight = patientWeight || '未提供';
        const text = patientText ? patientText.trim() : '未提供主訴描述';

        // 2. 獲取最新一代高效能 Gemini 模型
        const model = genAI.getGenerativeModel({
            model: "gemini-3.5-flash-lite", 
            generationConfig: { responseMimeType: "application/json" }
        });
        
        // 3. 醫學評估結構化 Prompt
        const prompt = `
你是一位專業的減肥與體重管理專科醫師。
現在管理系統傳入了學員（病人）的基本生理數據與自然語言主訴困境，請進行臨床醫學評估。

【學員基本資料】
- 姓名：${name}
- 身高：${height} cm
- 體重：${weight} kg
- 病人主訴："${text}"

【評估任務與標準說明】
1. 請幫病人計算 BMI = 體重(kg) / [身高(m)]^2，保留小數點後一位。
2. 根據台灣與亞洲區 BMI 體重標準進行判斷：
    - BMI < 18.5：體重過輕
    - 18.5 <= BMI < 24：正常範圍
    - 24 <= BMI < 27：過重
    - 27 <= BMI < 30：輕度肥胖
    - 30 <= BMI < 35：中度肥胖
    - BMI >= 35：重度肥胖
3. 綜合病人的 BMI 分級與自然語言主訴，評估 1-10 級的「急迫性分數 (urgency_score)」：
    - 8-10 分（高危險）：重度肥胖且伴隨極端斷食危害、情緒性暴食症、或嚴重的心理/生理代謝危機。
    - 5-7 分（中風險）：中輕度肥胖或過重，伴隨代謝停滯期心理挫折、暴飲暴食或睡眠障礙。
    - 1-4 分（低風險）：體態輕微微調，無明顯生理與心理危機。

請嚴格回傳標準 JSON 格式，不要包含任何 Markdown 標籤 (如 \`\`\`json) 或額外解釋文字。

需回傳的 JSON 欄位結構：
{
    "calculated_bmi": "計算出的 BMI 數值 (字串，例如 '29.4')",
    "weight_status": "體重分級判斷結果 (字串，例如 '輕度肥胖')",
    "emotion": "減重核心情緒 (字串，例如：焦慮、挫折、內疚、失去動力)",
    "urgency_score": 1-10 急迫性分數 (數字),
    "symptoms": ["生理與心理異常症狀字串陣列", "例如：暴飲暴食", "失眠"],
    "needs_human_intervention": 是否需人工介入 (布林值),
    "summary": "給專業減重團隊的醫療交班摘要 (字串，請結合病人的 BMI、肥胖分級、行為病因與下一階段建議)"
}
`;

        // 4. 發送請求至 Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawJsonText = response.text();

        // 5. 解析並回傳標準 JSON 格式
        return JSON.parse(rawJsonText);

    } catch (error) {
        console.error("❌ [Gemini AI Service Error] 呼叫或解析發生錯誤：", error);
        
        // 回傳降級的安全預設值
        return { 
            calculated_bmi: "無法計算",
            weight_status: "未知狀態",
            emotion: "未知",
            urgency_score: 0, 
            summary: `AI 分析失敗（原因：${error.message || '未知錯誤'}），請醫護同仁進行人工檢視。`, 
            symptoms: ["分析模組異常"], 
            needs_human_intervention: true 
        };
    }
}

// 匯出模組
module.exports = { analyzePatientFeedback };
