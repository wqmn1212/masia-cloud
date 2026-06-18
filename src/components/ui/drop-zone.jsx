import { useState, useRef, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';

/**
 * 드래그앤드롭 + 클릭 업로드 가능한 DropZone 컴포넌트
 *
 * @param {object} props
 * @param {function(File): Promise} props.onFile - 파일 드롭/선택 시 호출
 * @param {boolean} props.uploading - 업로드 중 여부
 * @param {string} props.accept - 허용 파일 타입 (예: "image/*,video/*,.pdf")
 * @param {string} props.label - 표시 텍스트 (기본: "파일 선택")
 * @param {string} props.className - 추가 클래스
 * @param {boolean} props.compact - 컴팩트 모드 (버튼 형태)
 * @param {React.ReactNode} props.children - 커스텀 자식 (드롭존 내부를 직접 구성)
 */
export default function DropZone({
  onFile,
  uploading = false,
  accept,
  label = '파일 선택',
  className = '',
  compact = false,
  children,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  if (children) {
    return (
      <div
        className={`relative ${className}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-primary">
              <Upload className="w-5 h-5" />
              <span className="text-sm font-medium">여기에 드롭하여 업로드</span>
            </div>
          </div>
        )}
        {children}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`relative ${className}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <label className={`inline-flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-1.5 text-xs hover:bg-muted transition-colors ${isDragging ? 'border-primary bg-primary/10' : ''} ${className}`}>
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? '업로드 중...' : label}
          <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      <label className={`flex items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'hover:border-primary/50'} ${className}`}>
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Upload className="w-4 h-4" />
            <span>{label}</span>
          </div>
        )}
        <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </label>
    </div>
  );
}