// 카카오톡 "대화 내보내기" 파일 읽기 → 미팅 기록 대화 칸에 넣을 글
// 지원: PC(.txt "[이름] [오후 2:14] 내용" + 날짜 줄), 휴대폰(.txt "2026년 11월 16일 오후 2:14, 이름 : 내용" · iOS "2026. 11. 16. 오후 2:14, 이름 : 내용"),
//       Mac(.csv "Date,User,Message"). 사진·이모티콘·입장/퇴장·삭제된 메시지 같은 시스템 줄은 뺀다.
// 줄바꿈이 있는 메시지는 앞 메시지에 이어 붙인다.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const to24 = (ampm, h, mi) => {
  let hh = Number(h);
  if (ampm === '오후' && hh < 12) hh += 12;
  if (ampm === '오전' && hh === 12) hh = 0;
  return `${pad(hh)}:${pad(mi)}`;
};
const SYSTEM = /^(사진|사진 \d+장|동영상|이모티콘|파일: .*|삭제된 메시지입니다\.?|.+님이 (들어왔습니다|나갔습니다|.+님을 초대했습니다)\.?|.+님을 내보냈습니다\.?|보이스톡 .*|페이스톡 .*|샵검색: .*)$/;

const DATE_LINE = /^-+\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일 .*?-+\s*$|^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일\s*$/;
const PC_MSG = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ([\s\S]*)$/;
const MOBILE_MSG = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+?) : ([\s\S]*)$/;
const IOS_MSG = /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.+?) : ([\s\S]*)$/;
const CSV_ROW = /^"?(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::\d{2})?"?,/;

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/** 파일 글 → { format, messages: [{date, time, who, text}], dates: [오름차순 날짜] } */
export function parseKakao(raw) {
  const text = String(raw || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const messages = [];
  let format = '';
  let curDate = '';
  const push = (m) => { if (!SYSTEM.test(m.text.trim())) messages.push({ ...m, text: m.text.trim() }); };
  const append = (line) => { const last = messages[messages.length - 1]; if (last && line.trim() && !SYSTEM.test(line.trim())) last.text += `\n${line}`; };

  if (/^"?Date"?,"?User"?,"?Message"?/i.test(lines[0] || '')) {
    format = 'csv';
    // 메시지 안 줄바꿈은 따옴표 안에 있으므로 행 단위로 다시 모은다
    let buf = '';
    const rows = [];
    for (const line of lines.slice(1)) {
      if (CSV_ROW.test(line) && buf) { rows.push(buf); buf = line; } else buf = buf ? `${buf}\n${line}` : line;
    }
    if (buf.trim()) rows.push(buf);
    for (const row of rows) {
      const m = row.match(CSV_ROW);
      if (!m) continue;
      const [dt, who, ...rest] = splitCsvLine(row);
      push({ date: ymd(m[1], m[2], m[3]), time: `${m[4]}:${m[5]}`, who: who || '', text: rest.join(',') });
      void dt;
    }
  } else {
    for (const line of lines) {
      let m;
      if ((m = line.match(DATE_LINE))) { curDate = m[1] ? ymd(m[1], m[2], m[3]) : ymd(m[4], m[5], m[6]); continue; }
      if ((m = line.match(PC_MSG))) { format ||= 'pc'; push({ date: curDate, time: to24(m[2], m[3], m[4]), who: m[1], text: m[5] }); continue; }
      if ((m = line.match(MOBILE_MSG))) { format ||= 'mobile'; push({ date: ymd(m[1], m[2], m[3]), time: to24(m[4], m[5], m[6]), who: m[7], text: m[8] }); continue; }
      if ((m = line.match(IOS_MSG))) { format ||= 'ios'; push({ date: ymd(m[1], m[2], m[3]), time: to24(m[4], m[5], m[6]), who: m[7], text: m[8] }); continue; }
      if (messages.length && !/^(저장한 날짜|.+ 님과 카카오톡 대화|.+ \d+ 카카오톡 대화)/.test(line)) append(line);
    }
  }
  const dates = [...new Set(messages.map((m) => m.date).filter(Boolean))].sort();
  return { format: format || 'unknown', messages, dates };
}

/** 고른 날짜 범위의 메시지를 대화 칸 글로 (날짜가 바뀔 때마다 구분 줄) */
export function kakaoTranscript(messages, { from = '', to = '' } = {}) {
  const out = [];
  let day = null;
  for (const m of messages) {
    if (from && m.date && m.date < from) continue;
    if (to && m.date && m.date > to) continue;
    if (m.date !== day) { day = m.date; if (day) out.push(`--- ${day} ---`); }
    out.push(`[${m.who}] [${m.time}] ${m.text}`);
  }
  return out.join('\n');
}

/** 글자 수 한도 안에 들어가는 가장 이른 시작 날짜 (최근 대화부터 채운다) */
export function fitFrom(messages, dates, limit = 60000) {
  if (!dates.length) return '';
  for (let i = 0; i < dates.length; i++) {
    if (kakaoTranscript(messages, { from: dates[i] }).length <= limit) return dates[i];
  }
  return dates[dates.length - 1];
}
