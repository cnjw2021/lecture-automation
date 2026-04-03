require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // Note: SDK 버전에 따라 listModels 메서드 위치가 다를 수 있음
    // 최신 SDK 기준으로는 내부 fetch를 통해 확인하거나 공식 문서를 따름
    console.log("현재 API 키로 접근 가능한 모델 목록을 확인합니다...");
    // 실제로는 API 키가 유효한지, 권한이 있는지 확인하는 과정입니다.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hi");
    console.log("✅ gemini-1.5-flash 접근 성공!");
  } catch (e) {
    console.error("❌ 모델 접근 실패:", e.message);
  }
}

listModels();
