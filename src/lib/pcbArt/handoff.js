// 다른 화면 → PCB 아트웍 스튜디오로 큰 데이터(배선된 제조 묶음 zip 등)를 넘긴다 (같은 탭 안에서만, 한 번 꺼내면 사라짐)
let pending = null;
export const putHandoff = (x) => { pending = x; };
export const takeHandoff = () => { const x = pending; pending = null; return x; };
