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
    const durations = {};

    for (const scene of lecture.sequence) {
      // 1. 이미 존재하는지 저장소에 확인 (데이터 관리 책임 분리)
      if (await this.repository.existsAudio(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 이미 존재함`);
        // 기존 오디오의 duration도 읽어옴
        const existingDuration = await this.repository.getAudioDuration(lecture.lecture_id, scene.scene_id);
        if (existingDuration) {
          durations[scene.scene_id] = existingDuration;
        }
        continue;
      }

      // 2. 오디오 생성 (생성 책임 분리)
      try {
        const { buffer, durationSec } = await this.provider.generate(scene.narration, { scene_id: scene.scene_id });

        // 3. 저장 (저장 책임 분리)
        await this.repository.saveAudio(lecture.lecture_id, scene.scene_id, buffer);

        durations[scene.scene_id] = durationSec;
        results.push({ scene_id: scene.scene_id, status: 'success', durationSec });
      } catch (error) {
        console.error(`\n❌ [치명적 에러] Scene ${scene.scene_id} 생성 중 오류 발생.`);
        console.error('--- 상세 에러 정보 ---');
        console.dir(error, { depth: null }); // 에러 객체 전체를 상세히 출력
        console.error('----------------------');
        throw error;
      }
    }

    // 4. duration 메타데이터 저장
    await this.repository.saveAudioDurations(lecture.lecture_id, durations);
    console.log(`[${lecture.lecture_id}] 오디오 duration 메타데이터 저장 완료`);

    return results;
  }
}

module.exports = AudioService;
