import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';

// 중국 등 느린 망에서도 빠르게 열리도록: 한 번 받은 데이터는 잠시 그대로 쓰고,
// 브라우저(localStorage)에 저장해 다음 접속 때 즉시 화면을 그린 뒤 뒤에서 새로 받는다.
const STORAGE_KEY = 'aegis-query-cache-v1';
const MAX_AGE = 24 * 60 * 60 * 1000; // 24시간

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 60 * 1000,
			gcTime: MAX_AGE,
		},
	},
});

function restore() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		if (saved && Date.now() - saved.at < MAX_AGE) hydrate(queryClientInstance, saved.state);
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		localStorage.removeItem(STORAGE_KEY);
	}
}

let timer = null;
function persist() {
	clearTimeout(timer);
	timer = setTimeout(() => {
		const state = dehydrate(queryClientInstance, {
			shouldDehydrateQuery: (q) => q.state.status === 'success',
		});
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), state }));
		} catch {
			localStorage.removeItem(STORAGE_KEY); // 용량 초과 시 저장 생략
		}
	}, 1000);
}

// 로그아웃·계정 전환 시 다른 사람의 데이터가 남지 않게 지운다
export function clearPersistedQueries() {
	localStorage.removeItem(STORAGE_KEY);
	queryClientInstance.clear();
}

if (typeof window !== 'undefined') {
	restore();
	queryClientInstance.getQueryCache().subscribe(persist);
}