import { base44 } from '@/api/base44Client';
export default async function meetingAudioClient(meetingId, action, payload = {}) {
  const { data } = await base44.functions.invoke('processMeetingAudio', { meeting_id: meetingId, action, ...payload });
  if (data?.error) throw new Error(data.error);
  return data;
}