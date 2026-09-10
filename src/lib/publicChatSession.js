// 상담 위젯 방문자 세션 키. 서버는 이 값을 아는 요청만 해당 스레드를 조회/작성할 수 있게 한다.
const KEY = 'chinasourcing_chat_session';

export function getChatSessionId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch (_e) {
    return null;
  }
}

// 세션을 새로 만들지 않고 기존 세션이 있는지만 확인 (첫 방문자에게 불필요한 조회를 피하기 위함)
export function peekChatSessionId() {
  try {
    return localStorage.getItem(KEY);
  } catch (_e) {
    return null;
  }
}
