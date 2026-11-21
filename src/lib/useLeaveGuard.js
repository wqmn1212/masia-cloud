import { useEffect, useRef } from 'react';

/**
 * 저장하지 않은 변경이 있을 때 화면을 떠나지 못하게 묻는다.
 * - 창 닫기·새로고침·주소 이동: 브라우저 기본 확인창 (beforeunload)
 * - 앱 안 링크(왼쪽 메뉴·뒤로 링크 등): 클릭을 가로채 확인 (BrowserRouter 에서는 useBlocker 를 쓸 수 없어서)
 * - 브라우저 뒤로 가기 (back: true 일 때만): 한 번 막고 확인한 뒤 진행. 변경 표시가 자주 켜졌다 꺼지는 화면(자동 저장)에는 쓰지 않는다
 */
export function useLeaveGuard(dirty, { message = '저장하지 않은 변경이 있습니다. 이 화면을 떠나면 사라집니다. 떠날까요?', back = false } = {}) {
  const ref = useRef({ dirty, message });
  ref.current = { dirty, message };

  useEffect(() => {
    const onBefore = (e) => { if (!ref.current.dirty) return undefined; e.preventDefault(); e.returnValue = ''; return ''; };
    const onClick = (e) => {
      if (!ref.current.dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target?.closest?.('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // 바깥 링크는 beforeunload 가 맡는다
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(ref.current.message)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', onBefore);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', onBefore); document.removeEventListener('click', onClick, true); };
  }, []);

  // 브라우저 뒤로 가기: 변경이 있는 동안 기록을 하나 쌓아 두고, 뒤로 가면 물어본다
  useEffect(() => {
    if (!dirty || !back) return undefined;
    const here = window.location.href;
    window.history.pushState({ leaveGuard: true }, '', here);
    const onPop = () => {
      if (!ref.current.dirty) return;
      if (window.confirm(ref.current.message)) { ref.current.dirty = false; window.history.back(); }
      else window.history.pushState({ leaveGuard: true }, '', here);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // 저장해서 변경이 사라졌으면 쌓아 둔 기록을 걷어 낸다 (뒤로 가기가 두 번 필요하지 않게)
      if (window.history.state?.leaveGuard && window.location.href === here) window.history.back();
    };
  }, [dirty, back]);
}
