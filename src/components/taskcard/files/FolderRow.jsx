import { Folder, Trash2 } from 'lucide-react';

export default function FolderRow({ folder, onOpen, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`"${folder.folder_name}" 폴더와 그 안의 모든 항목을 삭제할까요?`)) {
      onDelete();
    }
  };

  return (
    <div
      onDoubleClick={() => onOpen(folder)}
      className="flex items-center justify-between px-3 py-2 hover:bg-accent/40 group cursor-pointer"
    >
      <button
        onClick={() => onOpen(folder)}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
      >
        <Folder className="w-4 h-4 text-blue-500 flex-shrink-0 fill-blue-100" />
        <span className="text-sm truncate font-medium">{folder.folder_name}</span>
      </button>
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1.5 rounded transition-opacity"
        title="폴더 삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}