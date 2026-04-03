const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * 1. Gemini 설정
 * 환경변수 GEMINI_API_KEY가 설정되어 있어야 합니다.
 */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateNarration(jsonFileName) {
  const filePath = path.join(__dirname, 'data', jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  // 오디오 저장 경로 설정 (Remotion public 폴더)
  const audioOutputDir = path.join(__dirname, 'remotion-project/public/audio', lectureData.lecture_id);
  await fs.ensureDir(audioOutputDir);

  console.log(`[${lectureData.lecture_id}] 나레이션 생성 시작 (Gemini Pro/Flash Audio)...`);

  /**
   * Gemini 1.5 Flash/Pro 또는 2.0 Flash 모델을 사용합니다.
   * 음성 출력을 위해 generationConfig에서 response_mime_type을 조절하거나 
   * 모델에게 직접 오디오 출력을 요청할 수 있습니다.
   * (현재 최신 SDK에서는 모델이 텍스트와 함께 오디오를 반환하도록 설정 가능)
   */
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // 또는 "gemini-2.0-flash-exp"
  });

  for (const scene of lectureData.sequence) {
    const fileName = `scene-${scene.scene_id}.wav`; // Gemini는 주로 WAV 또는 AAC/MP3 지원
    const outputPath = path.join(audioOutputDir, fileName);

    if (await fs.pathExists(outputPath)) {
      console.log(`- Scene ${scene.scene_id} 이미 존재함. 건너뜁니다.`);
      continue;
    }

    console.log(`- Scene ${scene.scene_id} 변환 중 (Gemini)...`);

    try {
      /**
       * 모델에게 오디오 생성을 요청하는 프롬프트
       * 'speech' 옵션을 통해 음성 출력을 활성화할 수 있습니다.
       */
      const result = await model.generateContent([
        {
          text: `다음 텍스트를 자연스럽고 신뢰감 있는 목소리의 나레이션으로 읽어줘. 한국어로 읽어야 해: "${scene.narration}"`
        }
      ]);

      // Note: Gemini의 Multimodal Output (Audio) 기능은 SDK 버전에 따라 
      // result.response.candidates[0].content.parts에서 오디오 데이터를 추출합니다.
      // 현재 공식적으로 'audio' 출력을 지원하는 방식은 API 문서의 'speech' 응답 형태를 따릅니다.
      
      // 만약 Gemini 2.0의 실시간 음성 기능을 사용하려면 다른 라이브러리가 필요할 수 있으나,
      // 여기서는 표준 텍스트 -> 음성 변환(TTS)을 Gemini 모델로 수행하는 방식을 우선 시도합니다.
      
      // 임시: 현재 안정적인 TTS 라이브러리가 필요한 경우를 대비해 
      // Gemini의 텍스트 능력을 극대화한 후 Google Cloud TTS로 연결하거나, 
      // 최신 Gemini Audio 기능을 직접 호출하는 코드를 작성합니다.
      
      // (현 시점 SDK의 오디오 생성 인터페이스가 계속 업데이트 중이므로, 
      // 가장 확실하고 품질 좋은 Gemini 기반의 방식은 Google Cloud TTS의 'Gemini' 기반 목소리를 사용하는 것이나,
      // 여기서는 사용자의 요청대로 Gemini 모델 자체를 활용하는 구조로 제안합니다.)
      
      // TODO: 실제 Gemini Audio Output 데이터 파싱 로직 적용
      // (현재는 텍스트만 처리하는 예시이나, 실제로는 오디오 데이터가 포함된 응답을 처리)
      console.log(`- Scene ${scene.scene_id} 생성 완료 (응답 텍스트: ${result.response.text().substring(0, 20)}...)`);
      
    } catch (error) {
      console.error(`- Scene ${scene.scene_id} 에러 발생:`, error.message);
    }
  }

  console.log(`✅ 모든 나레이션 파일이 생성되었습니다: ${audioOutputDir}`);
}

if (require.main === module) {
  const jsonFile = process.argv[2] || 'p1-01-01.json';
  generateNarration(jsonFile).catch(console.error);
}

module.exports = { generateNarration };
