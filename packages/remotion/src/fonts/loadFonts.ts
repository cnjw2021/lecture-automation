import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadNotoSansJP } from '@remotion/google-fonts/NotoSansJP';

// Inter: latin only (weights used in metric/eyebrow tokens)
const { waitUntilDone: waitForInter } = loadInter('normal', {
  weights: ['500', '700', '900'],
  subsets: ['latin'],
});

// NotoSansJP: CJK subsets are indexed ([0]..[N]).
// suppressWarning: true を渡してリクエスト数警告を抑制する
const { waitUntilDone: waitForNotoSansJP } = loadNotoSansJP('normal', {
  weights: ['400', '500', '700', '800'],
  ignoreTooManyRequestsWarning: true,
});

export const waitForFonts = async (): Promise<void> => {
  await Promise.all([waitForInter(), waitForNotoSansJP()]);
};
