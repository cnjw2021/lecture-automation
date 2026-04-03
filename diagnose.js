require('dotenv').config();
const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;

/**
 * REST API를 사용하여 사용 가능한 모델 목록을 가져옴
 */
function listModels() {
  console.log(`🔍 API 키로 접근 가능한 모델 목록을 확인 중 (Key: ${API_KEY.substring(0, 10)}...)...`);
  
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1/models?key=${API_KEY}`,
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const json = JSON.parse(data);
        console.log("✅ 사용 가능한 모델 목록:");
        json.models.forEach(m => {
          console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
        });
      } else {
        console.error(`❌ 에러 발생 (Status: ${res.statusCode}):`, data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ 네트워크 에러: ${e.message}`);
  });
  req.end();
}

listModels();
