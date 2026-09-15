import { saveMeetingFile, readMeetingFile, signMeetingFile } from './meetingStorage.ts';
export async function meetingAudioAction(svc, log, body) {
  const update = data => svc.entities.MeetingLog.update(log.id, data);
  const parts = [...(log.audio_parts || [])];
  if (body.action === 'start') {
    if (parts.some(p => !p.transcript_uri)) throw new Error('이전 녹음의 전사를 먼저 재시도하세요');
    const session = crypto.randomUUID();
    await update({ audio_session: session, audio_status: 'RECORDING' });
    return { session };
  }
  if (body.action === 'chunk') {
    if (!body.session || body.session !== log.audio_session) throw new Error('다른 녹음 세션입니다. 저장된 녹음을 먼저 확인하세요');
    if (!Number.isInteger(body.index) || body.index < 0 || body.index > 9999) throw new Error('잘못된 녹음 순서');
    const key = `${body.session}:${String(body.index).padStart(5, '0')}`;
    const existing = parts.find(p => p.key === key);
    if (existing) return { key };
    if (parts.length >= 500) throw new Error('이 미팅의 녹음 구간 한도에 도달했습니다. 새 미팅을 생성하세요');
    if (typeof body.audio !== 'string' || body.audio.length > 32 * 1024 * 1024) throw new Error('녹음 구간은 25MB 미만이어야 합니다');
    const bytes = Uint8Array.from(atob(body.audio), c => c.charCodeAt(0));
    if (!bytes.length || bytes.length >= 25 * 1024 * 1024) throw new Error('녹음 구간 크기가 올바르지 않습니다');
    const type = String(body.mime || '').split(';')[0];
    const extensions = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };
    if (!extensions[type]) throw new Error('지원하지 않는 녹음 형식');
    await update({ audio_status: 'UPLOADING' });
    const uploaded = await svc.integrations.Core.UploadPrivateFile({ file: new File([bytes], `meeting-${body.index}.${extensions[type]}`, { type }) });
    if (!uploaded.file_uri) throw new Error('녹음 업로드 실패');
    parts.push({ key, uri: uploaded.file_uri });
    await update({ audio_parts: parts, recording_uris: parts.map(p => p.uri), audio_status: 'TRANSCRIBING' });
    return { key };
  }
  if (body.action === 'transcribe') {
    const part = parts.find(p => p.key === body.key);
    if (!part) throw new Error('녹음 구간을 찾을 수 없습니다');
    if (!part.transcript_uri) {
      await update({ audio_status: 'TRANSCRIBING' });
      const text = await svc.integrations.Core.TranscribeAudio({ audio_url: await signMeetingFile(svc, part.uri) });
      if (typeof text !== 'string') throw new Error('전사 응답을 확인할 수 없습니다');
      part.transcript_uri = await saveMeetingFile(svc, text, 'transcript-part.txt');
      await update({ audio_parts: parts });
    }
    return { ok: true };
  }
  if (body.action === 'finish') {
    if (!parts.length || parts.some(p => !p.transcript_uri)) throw new Error('남은 녹음 업로드·전사를 완료해 주세요');
    const text = (await Promise.all(parts.map(p => readMeetingFile(svc, p.transcript_uri)))).join('\n\n');
    const uri = await saveMeetingFile(svc, text, 'meeting-transcript.txt');
    await update({ transcript: text.slice(0, 16000), transcript_uri: uri, audio_status: 'DONE' });
    return { ok: true };
  }
  if (body.action === 'read') {
    return { transcript: log.transcript_uri ? await readMeetingFile(svc, log.transcript_uri) : (log.transcript || ''), recordings: await Promise.all(parts.map(async (p,i) => ({ name: `녹음 ${i + 1}`, url: await signMeetingFile(svc, p.uri) }))) };
  }
  throw new Error('지원하지 않는 녹음 요청');
}