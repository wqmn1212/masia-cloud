import { FileText, FileImage, FileVideo, FileSpreadsheet, Trash2, BadgeCheck, Send, MessageSquarePlus } from 'lucide-react';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import FileVisibilitySwitch from '@/components/files/FileVisibilitySwitch';
import { DOCUMENT_TYPES } from '@/components/files/documentTypes';
import { isCurrentApproved } from '@/lib/fileApproval';
import { REVIEW_LABEL } from '@/lib/fileReview';

const REVIEW_CLS = { PENDING: 'bg-warning/15 text-warning-text', APPROVED: 'bg-primary/10 text-primary', REVISION_REQUESTED: 'bg-destructive/10 text-destructive' };
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }) : '');

function getIcon(type) {
  const t = (type || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(t)) return FileImage;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(t)) return FileVideo;
  if (['xlsx', 'xls', 'csv'].includes(t)) return FileSpreadsheet;
  return FileText;
}

// approval: { replacedName, onApprove, onUnapprove, onMarkSent } — 공장 전달 승인본 표시·지정 (없으면 숨김)
// review: { onRequest, onCancel } — 고객 확인 요청 보내기·거두기 (없으면 숨김). 상태 표시는 file.client_review_status
export default function FileRow({ file, onDelete, onVisibilityChange, visibilityPending, approval, review }) {
  const Icon = getIcon(file.file_type);
  const approved = isCurrentApproved(file);
  const superseded = !!file.superseded_by_id;

  const handleDelete = () => {
    if (window.confirm(`"${file.file_name}" 파일을 삭제할까요?`)) {
      onDelete();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-muted group">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className={`text-sm truncate ${superseded ? 'text-muted-foreground line-through' : ''}`} title={file.file_name}>{file.file_name}</span>
        {approved && <span className="flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"><BadgeCheck className="h-3 w-3" />승인본 v{file.revision || 1} · 定稿</span>}
        {superseded && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">사용 안 함 · 已作废{approval?.replacedName ? ` → ${approval.replacedName}` : ''}</span>}
        {approved && file.sent_to_factory_at && <span className="shrink-0 text-[10px] text-muted-foreground">공장 전달 {shortDate(file.sent_to_factory_at)}</span>}
        {REVIEW_CLS[file.client_review_status] && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${REVIEW_CLS[file.client_review_status]}`} title={file.client_approved_by_name ? `${file.client_approved_by_name} · ${shortDate(file.client_approved_at)}` : undefined}>{REVIEW_LABEL[file.client_review_status]}{file.client_review_status === 'APPROVED' && file.client_approved_at ? ` ${shortDate(file.client_approved_at)}` : ''}</span>}
        {file.document_type && file.document_type !== 'GENERAL' && <span className="text-[10px] text-primary">{DOCUMENT_TYPES[file.document_type]}</span>}
        {file.file_type && (
          <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
            {file.file_type}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {review && !superseded && !file.client_approved_at && file.client_review_status !== 'PENDING' && <button type="button" onClick={review.onRequest} className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] text-primary opacity-70 hover:bg-primary/10 hover:opacity-100" title="고객에게 이 파일 확인을 요청"><MessageSquarePlus className="h-3 w-3" />고객 확인 요청</button>}
        {review && file.client_review_status === 'PENDING' && <button type="button" onClick={() => window.confirm('고객 확인 요청을 거둘까요?') && review.onCancel()} className="rounded px-1.5 py-1 text-[11px] text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100">확인 요청 거두기</button>}
        {approval && !superseded && !approved && <button type="button" onClick={approval.onApprove} className="rounded px-1.5 py-1 text-[11px] text-primary opacity-70 hover:bg-primary/10 hover:opacity-100" title="공장 전달 승인본으로 지정">승인본 지정</button>}
        {approval && approved && !file.sent_to_factory_at && <button type="button" onClick={approval.onMarkSent} className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] text-primary hover:bg-primary/10" title="공장에 보낸 것을 기록"><Send className="h-3 w-3" />공장에 보냄</button>}
        {approval && approved && <button type="button" onClick={() => window.confirm('승인본 지정을 취소할까요? 이 파일이 대체한 이전 승인본은 다시 승인본이 됩니다.') && approval.onUnapprove()} className="rounded px-1.5 py-1 text-[11px] text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100">승인 취소</button>}
        {onVisibilityChange && <FileVisibilitySwitch visible={file.client_visible} disabled={visibilityPending} onChange={onVisibilityChange} />}
        <DocumentOpenButton document={file} />
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1.5 rounded transition-opacity"
          title="파일 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}