import { FileText, FileImage, FileVideo, FileSpreadsheet, Download, Trash2, ExternalLink } from 'lucide-react';

function getIcon(type) {
  const t = (type || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(t)) return FileImage;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(t)) return FileVideo;
  if (['xlsx', 'xls', 'csv'].includes(t)) return FileSpreadsheet;
  return FileText;
}

export default function FileRow({ file, onDelete }) {
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
        {file.file_type && (
          <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
            {file.file_type}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <a
          href={file.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary p-1.5 rounded"
          title="새 탭에서 열기"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a
          href={file.file_url}
          download={file.file_name}
          className="text-muted-foreground hover:text-primary p-1.5 rounded"
          title="다운로드"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
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