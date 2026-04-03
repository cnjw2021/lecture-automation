const GeminiAudioProvider = require('../providers/GeminiAudioProvider');

/**
 * DIP와 Factory 패턴의 결합
 * 하위 구현체를 선택하고 생성하는 책임을 전담함
 */
class ProviderFactory {
  static createAudioProvider(type, settings) {
    switch (type) {
      case 'gemini':
        return new GeminiAudioProvider(settings.apiKey, settings.modelName);
      // case 'openai':
      //   return new OpenAIAudioProvider(settings.apiKey, settings.modelName);
      default:
        throw new Error(`지원하지 않는 프로바이더입니다: ${type}`);
    }
  }
}

module.exports = ProviderFactory;
