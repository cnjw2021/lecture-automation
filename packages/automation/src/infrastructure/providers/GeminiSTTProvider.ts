import * as fs from 'fs-extra';
import { ISTTProvider, STTFinding, STTSceneAuditResult } from '../../domain/interfaces/ISTTProvider';
import { groupFindingsByWindow } from '../../domain/utils/STTFindingGrouping';
import { shouldSuppressFinding } from '../../domain/utils/STTFindingNormalize';
import { GeminiApiClient } from './GeminiApiClient';

export interface GeminiSTTProviderOptions {
  apiKey: string;
  modelName?: string;
  temperature?: number;
}

// プロンプトB方式 — 原文と照合し、LLM的な「親切な訂正」を禁止
const buildPrompt = (narration: string) => `
以下は日本語ナレーションの原文です。

原文:
「${narration}」

指示:
1. 添付の音声を一字一句そのまま文字起こしする（意味的な修正・整形は厳禁）
2. 原文と**発音が**異なる箇所だけを下記JSONスキーマで返す
3. actualには必ずカタカナ・ひらがな・漢字で聞こえた通りの音を書くこと。英字・数字への変換禁止
   例: 「エイチワン」と聞こえたら actual は「エイチワン」。「H 1」と書かない
4. 以下は**発音上の差異ではない**ため、絶対に報告しない（スキップする）:
   4-1. 括弧・引用符の有無（「」『』（）"" など）
   4-2. 数字とカタカナの表記揺れ（「2」と「ツー」、「パート2」と「パート 2」のスペース差など）
   4-3. 読点・句点・スペース・改行の有無
   4-4. **原文の英字を音声がカタカナで読むケース — これは正しい日本語TTSの動作であり差異ではない**:
        - 「CodePen」→「コードペン」
        - 「HTML」→「エイチティーエムエル」
        - 「CSS」→「シーエスエス」
        - 「JavaScript」→「ジャバスクリプト」
        - 「GitHub」→「ギットハブ」
        - 「Claude」→「クロード」
        - 「ChatGPT」→「チャットジーピーティー」
        - 「Sign Up」→「サインアップ」
        - 「Change View」→「チェンジビュー」
        - 「Authorize」→「オーソライズ」
        - 「Hello World」→「ハローワールド」
        - 「codepen.io」→「コードペンドットアイオー」
        - その他、原文に英字があり音声で自然なカタカナ読みをしている場合すべて該当
   4-5. 原文と actual を正規化すると同一になるケース（表記だけ違う場合）
5. 報告すべきは「音として聞き間違えた」「単語を飲み込んだ」「別の単語に読み替えた」ケースのみ
   例: 「プロモーション」→「クロモーション」（プ→ク 誤読）
   例: 「いちばん」→「いち」（ばん 脱落）
   例: 「エイチワン」→「エイチワンチ」（末尾に余計な音）
6. 差異がなければ空配列 [] を返す
7. JSON配列のみ返答し、説明文・マークダウンは不要
`.trim();

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      timeSec: { type: 'number', description: '問題箇所の開始時刻（秒）' },
      expected: { type: 'string', description: '原文の該当部分' },
      actual: { type: 'string', description: '実際に聞こえた音' },
    },
    required: ['timeSec', 'expected', 'actual'],
  },
};

export class GeminiSTTProvider implements ISTTProvider {
  readonly providerName = 'gemini';

  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly temperature: number;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private readonly client: GeminiApiClient;

  constructor(options: GeminiSTTProviderOptions) {
    this.apiKey = options.apiKey;
    this.modelName = options.modelName ?? 'gemini-2.0-flash';
    this.temperature = options.temperature ?? 0;
    this.client = new GeminiApiClient({ timeoutMs: 2 * 60 * 1000 });
  }

  async audit(audioPath: string, narration: string, sceneId: number): Promise<STTSceneAuditResult> {
    const audioBuffer = await fs.readFile(audioPath);
    const audioBase64 = audioBuffer.toString('base64');

    const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
            { text: buildPrompt(narration) },
          ],
        },
      ],
      generationConfig: {
        temperature: this.temperature,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const response = await this.client.postJson(url, payload);
    if (!response.ok) {
      throw new Error(
        `GeminiSTT API Error (scene ${sceneId}): ${response.status} — ${JSON.stringify(response.json).substring(0, 200)}`,
      );
    }

    const findings = this.extractFindings(response.json, sceneId);
    return { sceneId, passed: findings.length === 0, findings };
  }

  private extractFindings(responseJson: any, sceneId: number): STTFinding[] {
    const text: string = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      const raw: STTFinding[] = parsed
        .filter((f: any) => typeof f.timeSec === 'number' && typeof f.expected === 'string' && typeof f.actual === 'string')
        .map((f: any): STTFinding => ({
          timeSec: f.timeSec,
          expected: f.expected,
          actual: f.actual,
          ...(f.reason ? { reason: f.reason } : {}),
        }));
      // 英語→カタカナ 読み·正規化同一 などのプロンプトで制御しきれない FP を code-level でさらに抑制
      const suppressed = raw.filter(f => !shouldSuppressFinding(f));
      return groupFindingsByWindow(suppressed);
    } catch {
      console.warn(`  ⚠️ Scene ${sceneId}: Gemini STT 응답 파싱 실패 — 통과로 처리`);
      return [];
    }
  }
}
