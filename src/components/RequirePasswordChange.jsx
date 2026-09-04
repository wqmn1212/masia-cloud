import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 초대로 발급된 계정의 최초 로그인 게이트. 비밀번호를 바꾸기 전에는 다른 화면에 접근할 수 없다.
export default function RequirePasswordChange({ user, onDone }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setSaving(true);
    try {
      await base44.auth.changePassword({ userId: user.id, currentPassword, newPassword });
      await base44.entities.User.update(user.id, { must_change_password: false });
      onDone?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      icon={KeyRound}
      title="비밀번호 변경"
      subtitle="처음 로그인하셨습니다. 계속하려면 새 비밀번호를 설정해 주세요."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>현재 비밀번호</Label>
          <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>새 비밀번호</Label>
          <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8자 이상" />
        </div>
        <div className="space-y-1.5">
          <Label>새 비밀번호 확인</Label>
          <Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          비밀번호 변경하고 계속하기
        </Button>
      </form>
    </AuthLayout>
  );
}
