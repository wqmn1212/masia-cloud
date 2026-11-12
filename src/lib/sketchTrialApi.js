// 메인페이지 스케치 시안 체험: 이미지 줄이기, 서버 호출, 끊겼을 때 결과 다시 받기
import { base44 } from '@/api/base44Client';
import { getFirstTouch } from '@/lib/utmTracking';

const KEY = 'aegis_sketch_trial';
const MAX_SIDE = 1600;

export const savedToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const remember = (token) => { try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch { /* 저장 못 해도 진행 */ } };
export const forgetTrial = () => remember('');

/** 휴대폰 사진은 크므로 긴 변 1600px JPEG 로 줄여 보낸다. 브라우저가 못 읽는 형식이면 예외 */
export async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('image_type')); i.src = url; });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    return { name: 'sketch.jpg', type: 'image/jpeg', data: dataUrl.split(',')[1] || '', preview: dataUrl };
  } finally { URL.revokeObjectURL(url); }
}

const call = (payload) => base44.functions.invoke('sketchTrial', payload).then((r) => r.data);
const errCode = (e) => e?.response?.data?.code || (e?.response?.status === 429 ? 'limit_daily' : '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const getTrial = (token) => call({ action: 'get', token }).then((d) => d.trial);

/**
 * 시안 만들기. 서버가 답을 준 실패(한도·형식 등)는 바로 code 와 함께 던지고,
 * 요청이 끊긴 경우에는 같은 번호로 3분 동안 결과를 다시 찾는다.
 */
export async function createTrial(values, image, lang) {
  const token = crypto.randomUUID();
  remember(token);
  try {
    const d = await call({ ...values, token, image: { name: image.name, type: image.type, data: image.data }, lang, referrer: document.referrer || '', ...getFirstTouch() });
    return d.trial;
  } catch (e) {
    if (e?.response?.status && e.response.status < 500) { forgetTrial(); throw Object.assign(new Error('trial'), { code: errCode(e) || 'fallback' }); }
    if (e?.response?.data?.code === 'generate') { forgetTrial(); throw Object.assign(new Error('trial'), { code: 'generate' }); }
    for (let i = 0; i < 36; i++) {
      await wait(5000);
      const t = await getTrial(token).catch(() => null);
      if (t?.status === 'READY') return t;
      if (t?.status === 'FAILED') break;
    }
    forgetTrial();
    throw Object.assign(new Error('trial'), { code: 'fallback' });
  }
}

export const inquireTrial = (token, variant, extra) => call({ action: 'inquire', token, variant, ...extra }).then((d) => d.trial);
