import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 가입 직후 호출: 이메일로 저장된 PendingInvitation 을 찾아 본인 계정에 tier/service_admin_id 적용
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 이미 tier 가 있으면 스킵
    if (user.account_tier) {
      return Response.json({ ok: true, alreadyClaimed: true, tier: user.account_tier });
    }

    const invites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email: user.email,
      claimed: false,
    });

    if (invites.length === 0) {
      return Response.json({ ok: true, noInvite: true });
    }

    // 가장 최근 초대 1건 적용
    const invite = invites[0];
    const updateData = {
      account_tier: invite.account_tier,
      is_active: true,
      account_label: invite.account_label || '',
    };
    if (invite.service_admin_id) {
      updateData.service_admin_id = invite.service_admin_id;
    }

    await base44.asServiceRole.entities.User.update(user.id, updateData);
    await base44.asServiceRole.entities.PendingInvitation.update(invite.id, { claimed: true });

    return Response.json({ ok: true, claimed: true, tier: invite.account_tier });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});