import React from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { inviteText } from '@/lib/factoryRequest';

// 링크와 PIN은 만들 때 한 번만 보인다 (서버에는 해시만 남음). 잃어버리면 '다시 만들기'로 새 링크를 만든다.
export default function FactoryInviteDialog({ invite, onClose, onReissue }) {
  const { lang } = useLanguage();
  const L = (ko, zh) => (lang === 'zh' ? zh : ko);
  if (!invite) return null;
  const text = invite.reissueOnly ? '' : inviteText(invite);
  const copy = async () => { await navigator.clipboard.writeText(text); toast({ title: L('복사했습니다. 위챗으로 공장에 보내세요', '已复制，请通过微信发给工厂') }); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-base"><KeyRound className="h-4 w-4 text-primary" />{invite.reissueOnly ? L('링크·PIN 다시 만들기', '重新生成链接和验证码') : L('공장에 보낼 링크와 PIN', '发给工厂的链接和验证码')}</DialogTitle>
          <DialogDescription className="text-label">
            {invite.reissueOnly
              ? L('링크와 PIN은 보안을 위해 만들 때 한 번만 보여 드립니다. 다시 만들면 이전 링크는 바로 막히고, 공장이 올린 내용은 그대로 남습니다.', '为安全起见，链接和验证码只在生成时显示一次。重新生成后旧链接立即失效，工厂已上传的内容保留。')
              : L('이 창을 닫으면 PIN을 다시 볼 수 없습니다. 지금 복사해 위챗으로 보내세요.', '关闭此窗口后无法再查看验证码，请现在复制并通过微信发送。')}
          </DialogDescription>
        </DialogHeader>
        {!invite.reissueOnly && (
          <>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 p-3 text-label">
              <span className="text-muted-foreground">PIN</span><span className="font-mono text-lg font-semibold tracking-[0.3em]">{invite.pin}</span>
              <span className="text-muted-foreground">{L('링크', '链接')}</span><span className="break-all font-mono text-caption">{invite.link}</span>
            </div>
            <Textarea readOnly rows={8} className="text-xs" value={text} />
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{L('닫기', '关闭')}</Button>
          {invite.reissueOnly
            ? <Button onClick={() => onReissue(invite.requestId)}>{L('다시 만들기', '重新生成')}</Button>
            : <Button className="gap-1" onClick={copy}><Copy className="h-4 w-4" />{L('안내문 복사', '复制说明')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
