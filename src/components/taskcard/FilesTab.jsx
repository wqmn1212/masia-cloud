import { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FolderPlus, FolderUp, Upload, Loader2, FolderOpen } from 'lucide-react';
import Breadcrumbs from './files/Breadcrumbs';
import FolderRow from './files/FolderRow';
import FileRow from './files/FileRow';
import NewFolderDialog from './files/NewFolderDialog';

export default function FilesTab({ card }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = 루트
  const [path, setPath] = useState([]); // [{id, name}]
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderUploading, setFolderUploading] = useState(false);
  const [folderProgress, setFolderProgress] = useState({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const foldersKey = ['card_folders', card.id];
  const filesKey = ['card_attachments', card.id];

  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: foldersKey,
    queryFn: () => base44.entities.CardFolder.filter({ card_id: card.id }, '-created_date'),
  });

  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: filesKey,
    queryFn: () => base44.entities.CardAttachment.filter({ card_id: card.id }, '-created_date'),
  });

  const currentFolders = useMemo(
    () => folders.filter(f => (f.parent_folder_id || null) === currentFolderId),
    [folders, currentFolderId]
  );
  const currentFiles = useMemo(
    () => files.filter(f => (f.folder_id || null) === currentFolderId),
    [files, currentFolderId]
  );

  const createFolderMutation = useMutation({
    mutationFn: async (name) => {
      const user = await base44.auth.me().catch(() => null);
      return base44.entities.CardFolder.create({
        card_id: card.id,
        parent_folder_id: currentFolderId || undefined,
        folder_name: name,
        created_by_name: user?.full_name || '',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: foldersKey }),
  });

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      await base44.entities.CardAttachment.create({
        card_id: card.id,
        folder_id: currentFolderId || undefined,
        file_name: file.name,
        file_type: ext,
        file_url,
        uploader_name: user?.full_name || '',
        uploader_role: 'HQ',
      });
      qc.invalidateQueries({ queryKey: filesKey });
    } finally {
      setUploading(false);
    }
  };

  const handleFolderUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArr = Array.from(fileList);
    setFolderUploading(true);
    setFolderProgress({ current: 0, total: filesArr.length });
    try {
      const user = await base44.auth.me().catch(() => null);
      const uploaderName = user?.full_name || '';

      // 1) 폴더 계층 수집 — 고유한 경로 모두
      const folderPathsSet = new Set();
      filesArr.forEach(f => {
        const rel = f.webkitRelativePath || f._relPath || f.name;
        const parts = rel.split('/');
        for (let i = 1; i < parts.length; i++) {
          folderPathsSet.add(parts.slice(0, i).join('/'));
        }
      });

      // 2) 다이어렌트 순으로 정렬 후 폴더 생성 — 부모 먼저
      const folderPaths = Array.from(folderPathsSet).sort(
        (a, b) => a.split('/').length - b.split('/').length
      );
      const pathToId = new Map();
      for (const p of folderPaths) {
        const parts = p.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const parentId = parentPath ? pathToId.get(parentPath) : currentFolderId;
        const created = await base44.entities.CardFolder.create({
          card_id: card.id,
          parent_folder_id: parentId || undefined,
          folder_name: name,
          created_by_name: uploaderName,
        });
        pathToId.set(p, created.id);
      }

      // 3) 파일 업로드 + 엔티티 생성
      let done = 0;
      for (const file of filesArr) {
        const rel = file.webkitRelativePath || file._relPath || file.name;
        const parts = rel.split('/');
        const parentPath = parts.slice(0, -1).join('/');
        const folderId = parentPath ? pathToId.get(parentPath) : currentFolderId;
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        await base44.entities.CardAttachment.create({
          card_id: card.id,
          folder_id: folderId || undefined,
          file_name: file.name,
          file_type: ext,
          file_url,
          uploader_name: uploaderName,
          uploader_role: 'HQ',
        });
        done++;
        setFolderProgress({ current: done, total: filesArr.length });
      }

      qc.invalidateQueries({ queryKey: foldersKey });
      qc.invalidateQueries({ queryKey: filesKey });
    } finally {
      setFolderUploading(false);
      setFolderProgress({ current: 0, total: 0 });
    }
  };

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId) => {
      const folderIdsToDelete = [];
      const fileIdsToDelete = [];
      const stack = [folderId];
      while (stack.length) {
        const fid = stack.pop();
        folderIdsToDelete.push(fid);
        folders.filter(f => f.parent_folder_id === fid).forEach(c => stack.push(c.id));
        files.filter(f => f.folder_id === fid).forEach(f => fileIdsToDelete.push(f.id));
      }
      await Promise.all(fileIdsToDelete.map(id => base44.entities.CardAttachment.delete(id)));
      await Promise.all(folderIdsToDelete.map(id => base44.entities.CardFolder.delete(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foldersKey });
      qc.invalidateQueries({ queryKey: filesKey });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id) => base44.entities.CardAttachment.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: filesKey }),
  });

  const enterFolder = (folder) => {
    setCurrentFolderId(folder.id);
    setPath(p => [...p, { id: folder.id, name: folder.folder_name }]);
  };

  const navigateTo = (idx) => {
    if (idx < 0) {
      setCurrentFolderId(null);
      setPath([]);
    } else {
      const newPath = path.slice(0, idx + 1);
      setPath(newPath);
      setCurrentFolderId(newPath[idx].id);
    }
  };

  const currentFolderName = path.length ? path[path.length - 1].name : '루트';
  const isLoading = loadingFolders || loadingFiles;
  const isEmpty = !isLoading && currentFolders.length === 0 && currentFiles.length === 0;

  // 드래그앤드롭: FileSystemEntry 재귀 탐색
  const traverseEntry = (entry, basePath = '') => new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((f) => {
        f._relPath = basePath ? `${basePath}/${f.name}` : f.name;
        resolve([f]);
      }, () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const newBase = basePath ? `${basePath}/${entry.name}` : entry.name;
      const collected = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            const nested = await Promise.all(collected.map((e) => traverseEntry(e, newBase)));
            resolve(nested.flat());
          } else {
            collected.push(...entries);
            readBatch();
          }
        }, () => resolve([]));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return;
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) promises.push(traverseEntry(entry));
    }
    const nested = await Promise.all(promises);
    const allFiles = nested.flat();
    if (allFiles.length > 0) handleFolderUpload(allFiles);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounter.current++;
      setIsDragging(true);
    }
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="space-y-3 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-20 rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-8 h-8 text-primary mb-2" />
          <p className="text-sm font-medium text-primary">여기에 드롭하여 업로드</p>
          <p className="text-[11px] text-muted-foreground mt-1">파일과 폴더 모두 지원</p>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Breadcrumbs path={path} onNavigate={navigateTo} />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewFolder(true)}
            className="h-8 text-xs gap-1"
          >
            <FolderPlus className="w-3.5 h-3.5" /> 새 폴더
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={folderUploading}
            className="h-8 text-xs gap-1"
          >
            {folderUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderUp className="w-3.5 h-3.5" />}
            {folderUploading
              ? `업로드 중 ${folderProgress.current}/${folderProgress.total}`
              : '폴더 업로드'}
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs gap-1"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            파일 업로드
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = '';
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            {...{ webkitdirectory: '', directory: '' }}
            onChange={(e) => {
              const list = e.target.files;
              if (list && list.length > 0) handleFolderUpload(list);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* File list */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-xs">이 폴더는 비어있습니다</p>
            <p className="text-[10px] mt-1">새 폴더를 만들거나 파일을 업로드하세요</p>
          </div>
        ) : (
          <div className="divide-y">
            {currentFolders.map(folder => (
              <FolderRow
                key={folder.id}
                folder={folder}
                onOpen={enterFolder}
                onDelete={() => deleteFolderMutation.mutate(folder.id)}
              />
            ))}
            {currentFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                onDelete={() => deleteFileMutation.mutate(file.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {!isLoading && !isEmpty && (
        <div className="text-[10px] text-muted-foreground text-right px-1">
          폴더 {currentFolders.length}개 · 파일 {currentFiles.length}개
        </div>
      )}

      <NewFolderDialog
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={(name) => {
          createFolderMutation.mutate(name);
          setShowNewFolder(false);
        }}
        parentName={currentFolderName}
      />
    </div>
  );
}