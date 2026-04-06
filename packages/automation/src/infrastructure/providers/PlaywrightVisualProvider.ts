import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { Scene, PlaywrightVisual } from '../../domain/entities/Lecture';

export class PlaywrightVisualProvider implements IVisualProvider {
  async record(scene: Scene, outputPath: string): Promise<void> {
    if (scene.visual.type !== 'playwright') {
      return;
    }

    const visualConfig = scene.visual as PlaywrightVisual;
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: path.dirname(outputPath),
        size: { width, height },
      }
    });

    const page = await context.newPage();

    try {
      console.log(`- Scene ${scene.scene_id} 녹화 시작...`);
      for (const action of visualConfig.action) {
        try {
          switch (action.cmd) {
            case 'goto':
              if (action.url) {
                try {
                  await page.goto(action.url, { waitUntil: 'load', timeout: 20000 });
                } catch (_) {
                  console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
                }
                // 페이지 로드 후 커서 자동 주입
                await page.evaluate(() => {
                  if (document.getElementById('__edu_cur__')) return;
                  const cur = document.createElement('div');
                  cur.id = '__edu_cur__';
                  cur.style.cssText = [
                    'position:fixed', 'left:-100px', 'top:-100px',
                    'width:14px', 'height:14px', 'border-radius:50%',
                    'background:rgba(0,0,0,0.85)', 'border:2px solid rgba(255,255,255,0.9)',
                    'box-shadow:0 0 0 1px rgba(0,0,0,0.4)',
                    'pointer-events:none', 'z-index:2147483648',
                    'transform:translate(-50%,-50%)',
                  ].join(';');
                  document.body.appendChild(cur);
                  document.addEventListener('mousemove', (e: MouseEvent) => {
                    cur.style.left = e.clientX + 'px';
                    cur.style.top = e.clientY + 'px';
                  });
                });
              }
              break;
            case 'wait':
              if (action.ms) await page.waitForTimeout(action.ms);
              break;
            case 'type':
              if (action.selector && action.key) await page.type(action.selector, action.key, { delay: 100 });
              break;
            case 'click':
              if (action.selector) await page.click(action.selector, { timeout: 10000 });
              break;
            case 'focus':
              if (action.selector) await page.focus(action.selector, { timeout: 10000 });
              break;
            case 'mouse_drag':
              if (action.from && action.to) {
                await page.mouse.move(action.from[0], action.from[1]);
                await page.mouse.down();
                await page.mouse.move(action.to[0], action.to[1], { steps: 10 });
                await page.mouse.up();
              }
              break;
            case 'mouse_move':
              if (action.to) {
                await page.mouse.move(action.to[0], action.to[1], { steps: 30 });
                await page.waitForTimeout(200);
              }
              break;
            case 'press':
              if (action.key) await page.keyboard.press(action.key);
              break;
            case 'disable_css':
              await page.evaluate(() => {
                Array.from(document.styleSheets).forEach(sheet => {
                  try {
                    const owner = sheet.ownerNode as Element | null;
                    if (owner?.id?.startsWith('__edu')) return;
                    if (owner?.closest?.('#__edu_devtools__')) return;
                    sheet.disabled = true;
                  } catch (_) {}
                });
              });
              await page.waitForTimeout(300);
              break;
            case 'enable_css':
              await page.evaluate(() => {
                Array.from(document.styleSheets).forEach(sheet => {
                  try { sheet.disabled = false; } catch (_) {}
                });
              });
              await page.waitForTimeout(300);
              break;
            case 'open_devtools':
              await page.evaluate(() => {
                if (document.getElementById('__edu_devtools__')) return;

                function escHtml(str: string): string {
                  return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                }

                function renderAttrs(el: Element): string {
                  return Array.from(el.attributes)
                    .slice(0, 3)
                    .map(a => {
                      const val = a.value.length > 40 ? a.value.substring(0, 40) + '…' : a.value;
                      return ` <span style="color:#9cdcfe">${escHtml(a.name)}</span>=<span style="color:#ce9178">"${escHtml(val)}"</span>`;
                    })
                    .join('');
                }

                function renderTree(el: Element, depth = 0): string {
                  if (depth > 4 || !el.tagName) return '';
                  const tag = el.tagName.toLowerCase();
                  const attrs = renderAttrs(el);
                  const indent = depth * 14;
                  const children = Array.from(el.children).slice(0, 5);

                  if (children.length === 0) {
                    const raw = el.textContent?.trim() ?? '';
                    const text = raw.length > 50 ? raw.substring(0, 50) + '…' : raw;
                    return `<div style="padding-left:${indent}px;line-height:20px;white-space:nowrap;overflow:hidden">` +
                      `<span style="color:#4ec9b0">&lt;${tag}</span>${attrs}<span style="color:#4ec9b0">&gt;</span>` +
                      (text ? `<span style="color:#d4d4d4">${escHtml(text)}</span>` : '') +
                      `<span style="color:#4ec9b0">&lt;/${tag}&gt;</span></div>`;
                  }

                  return `<div style="padding-left:${indent}px;line-height:20px;white-space:nowrap;overflow:hidden">` +
                    `<span style="color:#6a9955">▶</span> ` +
                    `<span style="color:#4ec9b0">&lt;${tag}</span>${attrs}<span style="color:#4ec9b0">&gt;</span></div>` +
                    children.map(c => renderTree(c, depth + 1)).join('') +
                    `<div style="padding-left:${indent}px;line-height:20px;white-space:nowrap"><span style="color:#4ec9b0">&lt;/${tag}&gt;</span></div>`;
                }

                const htmlTree = renderTree(document.documentElement);

                const overlay = document.createElement('div');
                overlay.id = '__edu_devtools__';
                overlay.style.cssText = [
                  'position:fixed', 'right:0', 'top:0', 'bottom:0', 'width:38%',
                  'z-index:2147483647', 'display:flex', 'flex-direction:column',
                  'box-shadow:-4px 0 20px rgba(0,0,0,0.7)',
                  'animation:__dt_slide 0.25s ease-out',
                ].join(';');

                overlay.innerHTML = `
                  <style>
                    @keyframes __dt_slide { from { transform:translateX(100%); } to { transform:translateX(0); } }
                    #__edu_devtools__ * { box-sizing:border-box; margin:0; padding:0; }
                  </style>
                  <div style="display:flex;align-items:center;background:#2b2b2b;border-left:1px solid #3c3c3c;border-bottom:1px solid #3c3c3c;height:32px;flex-shrink:0;overflow:hidden">
                    <div style="display:flex;height:100%">
                      <div style="color:#fff;background:#1e1e1e;border-top:2px solid #4a9eff;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Elements</div>
                      <div style="color:#9aa0a6;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Console</div>
                      <div style="color:#9aa0a6;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Sources</div>
                      <div style="color:#9aa0a6;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Network</div>
                    </div>
                    <div style="margin-left:auto;padding:0 12px;color:#9aa0a6;font-size:20px;display:flex;align-items:center;height:100%">⋮</div>
                  </div>
                  <div style="display:flex;flex:1;overflow:hidden;background:#1e1e1e;font-family:Menlo,Consolas,'Courier New',monospace;font-size:12px;color:#d4d4d4;border-left:1px solid #3c3c3c">
                    <div style="flex:1;overflow:auto;padding:4px 0 4px 4px">
                      ${htmlTree}
                    </div>
                    <div id="__edu_devtools_styles__" style="width:200px;border-left:1px solid #3c3c3c;overflow:auto;padding:8px;flex-shrink:0">
                      <div style="color:#9aa0a6;font-size:11px;font-family:-apple-system,sans-serif;padding-bottom:6px;border-bottom:1px solid #3c3c3c;margin-bottom:8px">Styles&nbsp;&nbsp;Computed</div>
                      <div style="margin-bottom:2px"><span style="color:#a8c7fa">element</span><span style="color:#9aa0a6">.style {</span></div>
                      <div style="color:#9aa0a6;margin-bottom:10px">}</div>
                      <div style="color:#9aa0a6;margin-bottom:4px">body {</div>
                      <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">font-family</span>: <span style="color:#ce9178">-apple-system</span>;</div>
                      <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">margin</span>: <span style="color:#b5cea8">0</span>;</div>
                      <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">padding</span>: <span style="color:#b5cea8">0</span>;</div>
                      <div style="color:#9aa0a6;margin-bottom:10px">}</div>
                      <div style="color:#9aa0a6;margin-bottom:4px">*, *::before {</div>
                      <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">box-sizing</span>: <span style="color:#ce9178">border-box</span>;</div>
                      <div style="color:#9aa0a6;margin-bottom:10px">}</div>
                      <div style="color:#9aa0a6;margin-bottom:4px">a {</div>
                      <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">color</span>: <span style="color:#ce9178">inherit</span>;</div>
                      <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">text-decoration</span>: <span style="color:#ce9178">none</span>;</div>
                      <div style="color:#9aa0a6">}</div>
                    </div>
                  </div>`;

                document.body.appendChild(overlay);
              });
              await page.waitForTimeout(400);
              break;
            case 'highlight':
              if (action.selector) {
                await page.evaluate((sel: string) => {
                  const el = document.querySelector(sel) as HTMLElement;
                  if (el) el.style.outline = '5px solid #ff007a';
                }, action.selector);
                await page.waitForTimeout(1500);
              }
              break;
            default:
              console.warn(`  ⚠️ 알려지지 않거나 미구현된 Action '${action.cmd}' (건너뜀)`);
          }
        } catch (actionError: any) {
          console.warn(`  ⚠️ Action '${action.cmd}' 실패 (건너뜀): ${actionError.message}`);
        }
      }
      await page.waitForTimeout(2000); 
    } catch (error: any) {
      console.error(`  > Scene ${scene.scene_id} 녹화 중 에러:`, error.message);
    } finally {
      const video = page.video();
      const videoPath = video ? await video.path() : null;
      await context.close();
      await browser.close();

      if (videoPath) {
        await fs.move(videoPath, outputPath, { overwrite: true });
        console.log(`  > Scene ${scene.scene_id} 녹화 저장 완료: ${outputPath}`);
      }
    }
  }
}
