/**
 * Abstract Audio Provider Interface (OCP 준수)
 * 새로운 모델이 추가되어도 이 인터페이스를 준수하면 AudioService를 수정할 필요가 없음
 */
class AudioProvider {
  async generate(text, options) {
    throw new Error('generate(text, options) must be implemented');
  }
}

module.exports = AudioProvider;
