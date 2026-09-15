import { base44 } from '@/api/base44Client';
import call from '@/components/taskcard/meetingAudioClient';
import { audioDraft, audioBase64 } from '@/components/taskcard/meetingAudioDrafts';
let active = null;
export default class MeetingRecorderEngine {
  constructor(log, userId, emit, complete) {
    Object.assign(this, { log, userId, emit, complete, running: false, seconds: 0, index: 0, saved: 0, queue: Promise.resolve(), failed: null });
  }
  async recoverable() {
    return (await audioDraft('list')).filter(p => p.meetingId === this.log.id && p.userId === this.userId).sort((a,b) => a.createdAt - b.createdAt || a.index - b.index);
  }
  report(phase, error = '') { this.emit({ phase, seconds: this.seconds, saved: this.saved, error }); }
  async start() {
    if (active) throw new Error('다른 미팅에서 녹음 중입니다');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('이 브라우저에서는 녹음을 지원하지 않습니다. HTTPS에서 최신 Chrome 또는 Safari를 사용하세요');
    if (!this.userId) throw new Error('로그인 정보를 불러온 뒤 다시 시도하세요');
    active = this;
    this.report('processing');
    try {
      if ((await this.recoverable()).length) throw new Error('남아 있는 녹음을 먼저 복구해 주세요');
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      this.session = (await call(this.log.id, 'start')).session;
      this.running = true; this.seconds = 0; this.index = 0; this.saved = 0; this.failed = null; this.queue = Promise.resolve();
      this.mime = ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m));
      if (!this.mime) throw new Error('지원하는 오디오 녹음 형식이 없습니다');
      this.segment();
      this.stream.getAudioTracks()[0].onended = () => this.stop();
      this.timer = setInterval(() => {
        if (this.recorder?.state === 'recording') {
          this.seconds++; this.segmentSeconds++;
          this.report('recording', this.failed ? '일부 구간 저장 실패 — 녹음 종료 후 재시도하세요' : '');
          if (this.segmentSeconds >= 600) this.recorder.stop();
        }
      }, 1000);
      if (navigator.wakeLock) this.wake = await navigator.wakeLock.request('screen').catch(() => null);
      this.report('recording');
    } catch (error) { this.release(); this.report('error', error.name === 'NotAllowedError' ? '마이크 권한을 허용해 주세요' : error.message); }
  }
  segment() {
    this.segmentSeconds = 0;
    const pieces = [];
    const recorder = new MediaRecorder(this.stream, { mimeType: this.mime, audioBitsPerSecond: 64000 });
    this.recorder = recorder;
    recorder.ondataavailable = e => { if (e.data.size) pieces.push(e.data); };
    recorder.onerror = () => { this.failed = new Error('마이크 녹음이 중단되었습니다'); this.stop(); };
    recorder.onstop = () => {
      const blob = new Blob(pieces, { type: recorder.mimeType });
      const index = this.index++;
      if (blob.size) {
        const part = { id: `${this.userId}:${this.log.id}:${this.session}:${index}`, userId: this.userId, meetingId: this.log.id, session: this.session, index, blob, createdAt: Date.now() };
        // Save immediately, independently of the network queue.
        const persisted = audioDraft('put', part);
        this.queue = this.queue.then(async () => { await persisted; if (!this.failed) await this.send(part); }).catch(error => { this.failed = error; });
        persisted.catch(error => {
          this.failed = new Error(`기기 저장 공간 부족: ${error.message}`);
          this.emergency = [...(this.emergency || []), part];
          if (this.running) this.stop();
        });
      }
      if (this.running) this.segment();
      else { this.release(); this.finalize(); }
    };
    recorder.start(1000);
  }
  async send(part) {
    const { key } = await call(this.log.id, 'chunk', { session: part.session, index: part.index, mime: part.blob.type, audio: await audioBase64(part.blob) });
    await call(this.log.id, 'transcribe', { key });
    await audioDraft('delete', part.id);
    this.saved++; this.report(this.running ? (this.recorder.state === 'paused' ? 'paused' : 'recording') : 'processing');
  }
  pause() {
    if (this.recorder?.state === 'recording') { this.recorder.pause(); this.report('paused'); }
    else if (this.recorder?.state === 'paused') { this.recorder.resume(); this.report('recording'); }
  }
  stop() {
    if (!this.running) return;
    this.running = false; this.report('processing');
    if (this.recorder?.state !== 'inactive') this.recorder.stop();
  }
  release() {
    this.running = false; clearInterval(this.timer);
    this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    this.wake?.release().catch(() => {}); if (active === this) active = null;
  }
  async finalize() {
    await this.queue;
    if (this.failed) { this.report('error', `${this.failed.message} — 저장된 구간을 재시도할 수 있습니다`); return; }
    try { await call(this.log.id, 'finish'); this.report('idle'); await this.complete(); }
    catch (error) { this.report('error', error.message); }
  }
  async retry() {
    this.report('processing'); this.failed = null;
    try {
      if (this.emergency?.length) {
        for (const part of this.emergency) await this.send(part);
        this.emergency = [];
      }
      for (const part of await this.recoverable()) await this.send(part);
      const log = await base44.entities.MeetingLog.get(this.log.id);
      for (const part of log.audio_parts || []) if (!part.transcript_uri) await call(log.id, 'transcribe', { key: part.key });
      await this.finalize();
    } catch (error) { this.report('error', error.message); }
  }
  dispose() { this.emit = () => {}; this.complete = async () => {}; this.stop(); this.release(); }
}