import { FileText, FileImage, FileVideo, FileSpreadsheet, Trash2 } from 'lucide-react';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import FileVisibilitySwitch from '@/components/files/FileVisibilitySwitch';
import { DOCUMENT_TYPES } from '@/components/files/documentTypes';

function getIcon(type) {
  const t = (type || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(t)) return FileImage;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(t)) return FileVideo;
  if (['xlsx', 'xls', 'csv'].includes(t)) return FileSpreadsheet;
  return FileText;
}

export default function FileRow({ file, onDelete, onVisibilityChange, visibilityPending }) {
  const Icon = getIcon(file.file_type);

  const handleDelete = () => {
    if (window.confirm(`"${file.file_name}" 파일을 삭제할까요?`)) {
      onDelete();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-accent/40 group">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm truncate" title={file.file_name}>{file.file_name}</span>
        {file.document_type && file.document_type !== 'GENERAL' && <span className="text-[10px] text-primary">{DOCUMENT_TYPES[file.document_type]}</span>}
        {file.file_type && (
          <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
            {file.file_type}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
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