/**
 * Chrome 브라우저 크롬 UI 공통 컴포넌트.
 * BrowserMockScreen(목업 콘텐츠)과 ImageScreen(실제 캡처 이미지) 양쪽에서 사용.
 */

const DOT_RED = '#ff5f57';
const DOT_YELLOW = '#febc2e';
const DOT_GREEN = '#28c840';
const CHROME_BG = '#dee1e6';
const TAB_ACTIVE_BG = '#ffffff';
const TOOLBAR_BG = '#f1f3f4';
const URL_BAR_BG = '#ffffff';

interface BrowserChromeProps {
  url: string;
  /** 탭에 표시할 제목. 미지정 시 url 사용 */
  tabTitle?: string;
  children: React.ReactNode;
}

/** 뒤로·앞으로·새로고침 버튼 (Chrome 스타일 플랫 아이콘) */
const NavButton: React.FC<{ children: React.ReactNode; disabled?: boolean }> = ({ children, disabled }) => (
  <div
    style={{
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      color: disabled ? '#bbb' : '#444',
      fontSize: 18,
      fontWeight: 300,
      flexShrink: 0,
      cursor: disabled ? 'default' : 'pointer',
    }}
  >
    {children}
  </div>
);

export const BrowserChrome: React.FC<BrowserChromeProps> = ({ url, tabTitle, children }) => {
  const displayTitle = tabTitle || url;

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        background: TAB_ACTIVE_BG,
      }}
    >
      {/* ── 탭 바 (macOS 트래픽 라이트 + 탭) ── */}
      <div
        style={{
          background: CHROME_BG,
          padding: '8px 12px 0',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
        }}
      >
        {/* macOS window controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, paddingRight: 16, flexShrink: 0 }}>
          {[DOT_RED, DOT_YELLOW, DOT_GREEN].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </div>

        {/* 활성 탭 */}
        <div
          style={{
            background: TAB_ACTIVE_BG,
            borderRadius: '8px 8px 0 0',
            padding: '7px 16px 7px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 120,
            maxWidth: 240,
          }}
        >
          <span style={{ fontSize: 12, color: '#555' }}>🌐</span>
          <span
            style={{
              fontSize: 13,
              color: '#222',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {displayTitle}
          </span>
          {/* 탭 닫기 버튼 */}
          <span style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>✕</span>
        </div>
      </div>

      {/* ── 툴바 (네비게이션 + 주소창) ── */}
      <div
        style={{
          background: TOOLBAR_BG,
          padding: '6px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderBottom: '1px solid #dadce0',
        }}
      >
        {/* 뒤로 / 앞으로 / 새로고침 */}
        <NavButton disabled>‹</NavButton>
        <NavButton disabled>›</NavButton>
        <NavButton>↻</NavButton>

        {/* 주소창 */}
        <div
          style={{
            flex: 1,
            background: URL_BAR_BG,
            borderRadius: 20,
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '0 8px',
            border: '1px solid #dadce0',
          }}
        >
          {/* 보안 아이콘 */}
          <span style={{ fontSize: 12, color: '#1a73e8', flexShrink: 0 }}>🔒</span>
          <span
            style={{
              fontSize: 14,
              color: '#202124',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {url}
          </span>
          {/* 즐겨찾기 */}
          <span style={{ fontSize: 14, color: '#5f6368', flexShrink: 0 }}>☆</span>
        </div>

        {/* 프로필 아이콘 (장식) */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#1a73e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          G
        </div>
      </div>

      {/* ── 페이지 콘텐츠 ── */}
      {children}
    </div>
  );
};
