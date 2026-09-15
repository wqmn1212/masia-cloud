import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { meetingAudioAction } from '../../shared/meetingAudioActions.ts';
import { meetingAnalysisAction } from '../../shared/meetingAnalysisActions.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    if (user.is_active === false || !['master','service','sub'].includes(user.account_tier)) return Response.json({ error: '미팅 접근 권한이 없습니다' }, { status: 403 });
    const body = await req.json();
    if (!body.meeting_id || !['start','chunk','transcribe','finish','read','analyze','apply'].includes(body.action)) return Response.json({ error: '미팅과 작업을 지정해 주세요' }, { status: 400 });
    const svc = base44.asServiceRole;
    const log = await svc.entities.MeetingLog.get(body.meeting_id);
    if (!log) return Response.json({ error: '미팅을 찾을 수 없습니다' }, { status: 404 });
    const card = await svc.entities.TaskCard.get(log.card_id);
    if (!card?.tenant_id || (user.account_tier !== 'master' && (!user.tenant_id || card.tenant_id !== user.tenant_id)) || (log.tenant_id && log.tenant_id !== card.tenant_id)) return Response.json({ error: '해당 카드의 팀원만 접근할 수 있습니다' }, { status: 403 });
    try {
      const result = ['analyze','apply'].includes(body.action)
        ? await meetingAnalysisAction(svc, log, card, body)
        : await meetingAudioAction(svc, log, body);
      return Response.json(result);
    } catch (error) {
      if (body.action === 'transcribe' || (body.action === 'chunk' && body.session === log.audio_session)) await svc.entities.MeetingLog.update(log.id, { audio_status: 'FAILED' });
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error.message || '미팅 처리에 실패했습니다' }, { status: 500 });
  }
}