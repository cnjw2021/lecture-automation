/**
 * SRP 준수: 오디오 생성 공정(Orchestration)만 담당함
 */
class AudioService {
  constructor(audioProvider, lectureRepository) {
    this.provider = audioProvider;
    this.repository = lectureRepository;
  }

  async processLecture(lecture) {
    console.log(`[${lecture.lecture_id}] 오디오 공정 시작 (Provider: ${this.provider.constructor.name})`);

    const results = [];
    for (const scene of lecture.sequence) {
      // 1. 이미 존재하는지 저장소에 확인 (데이터 관리 책임 분리)
      if (await this.repository.existsAudio(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 이미 존재함`);
        continue;
      }

      // 2. 오디오 생성 (생성 책임 분리)
      try {
        const audioBuffer = await this.provider.generate(scene.narration);
        
        // 3. 저장 (저장 책임 분리)
        await this.repository.saveAudio(lecture.lecture_id, scene.scene_id, audioBuffer);
        
        results.push({ scene_id: scene.scene_id, status: 'success' });
      } catch (error) {
        console.error(`- Scene ${scene.scene_id} 실패:`, error.message);
        results.push({ scene_id: scene.scene_id, status: 'failed', error: error.message });
      }
    }
    return results;
  }
}

module.exports = AudioService;
