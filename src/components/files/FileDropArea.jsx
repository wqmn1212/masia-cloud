import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

// 여러 파일 드래그앤드롭 영역 — 드래그 중 점선 테두리와 안내 오버레이 표시
export default function FileDropArea({ onFiles, disabled = false, className = '', children }) {
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);
  const hasFiles = (e) => e.dataTransfer?.types?.includes('Files');

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(e) => { if (!hasFiles(e) || disabled) return; e.preventDefault(); counter.current++; setDragging(true); }}
      onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        counter.current--;
        if (counter.current <= 0) { counter.current = 0; setDragging(false); }
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        counter.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (!disabled && files.length) onFiles(files);
      }}
    >
      {dragging && (
        <div className="absolute inset-0 z-20 rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-primary">
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">여기에 드롭하여 업로드</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}