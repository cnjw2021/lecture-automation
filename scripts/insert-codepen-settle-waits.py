"""
CodePen typing 씬의 type / press Enter 액션 사이에 settle wait 200ms 삽입.

대상:
- visual.type == "playwright"
- 액션 중 selector 가 "#box-html .CodeMirror textarea" 또는
  "#box-css .CodeMirror textarea" 를 사용하는 type, 그리고 그와 인접한 press Enter

삽입 규칙:
- type (CodeMirror) 다음 액션이 wait 가 아니면 wait 200 삽입
- press Enter 다음 액션이 wait 가 아니면 wait 200 삽입
- press Enter 가 CodeMirror typing 문맥인지 판단:
  - 직전 또는 직후 액션 중 type (CodeMirror) 가 가까이 있는 경우

부작용:
- 기존 wait 0 등은 그대로 둠 (수정자가 일부러 둔 sync marker 일 수 있음)
- mouse_move, click, goto 등 다른 액션과 인접한 type 사이에는 wait 안 넣음
  (이미 setup floor 가 충분히 길기 때문)
"""

import json
import sys
from pathlib import Path


def is_codepen_textarea_selector(sel: str) -> bool:
    return ".CodeMirror textarea" in sel


def is_codepen_type(action) -> bool:
    return (
        action.get("cmd") == "type"
        and is_codepen_textarea_selector(action.get("selector") or "")
    )


def is_press_enter(action) -> bool:
    return action.get("cmd") == "press" and action.get("key") == "Enter"


def is_wait(action) -> bool:
    return action.get("cmd") == "wait"


def insert_settle_waits(actions):
    """type/press Enter 사이에 wait 200 삽입.

    settle wait 가 필요한 트리거:
    - type (CodeMirror) 직후 다음 액션이 wait 가 아니면 → settle wait 필요
    - press Enter 직후 다음이 type (CodeMirror) 면 → settle wait 필요
    """
    new_actions = []
    n = len(actions)
    for i, action in enumerate(actions):
        new_actions.append(action)
        if i + 1 >= n:
            continue
        next_action = actions[i + 1]
        if is_wait(next_action):
            continue  # 이미 wait 가 있으면 건드리지 않음

        # type (CodeMirror) 다음 → 항상 settle 필요 (Enter, 다음 type, 또는 mouse_move)
        if is_codepen_type(action):
            new_actions.append({"cmd": "wait", "ms": 200})
            continue

        # press Enter → 다음 type (CodeMirror) 면 settle 필요
        if is_press_enter(action) and is_codepen_type(next_action):
            new_actions.append({"cmd": "wait", "ms": 200})
            continue

    return new_actions


def process_lecture(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    insertions = 0
    for scene in data.get("sequence", []):
        visual = scene.get("visual") or {}
        if visual.get("type") != "playwright":
            continue
        actions = visual.get("action") or []
        # 이 씬에 CodePen typing 이 하나도 없으면 건너뜀
        if not any(is_codepen_type(a) for a in actions):
            continue
        new_actions = insert_settle_waits(actions)
        added = len(new_actions) - len(actions)
        if added > 0:
            visual["action"] = new_actions
            insertions += added
            print(f"  scene {scene.get('scene_id')}: +{added} wait(200ms)")
    if insertions > 0:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return insertions


if __name__ == "__main__":
    targets = sys.argv[1:] or ["data/lecture-02-03.json"]
    total = 0
    for t in targets:
        p = Path(t)
        if not p.exists():
            print(f"⚠️ 파일 없음: {p}")
            continue
        print(f"📝 {p}")
        total += process_lecture(p)
    print(f"\n✅ 총 삽입: {total} 개의 wait(200ms)")
