import React, { useEffect, useState } from 'react';
import { renderMeshToDataURL } from '@/lib/meshRenderer';

/** 공용 렌더러로 구운 PNG 썸네일 */
export default function BomPartThumbnail({ mesh, size = 56, onClick }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!mesh?.positions?.length) return;
    // 렌더러가 하나이므로 프레임을 나눠 순차 처리한다
    const id = requestAnimationFrame(() => setUrl(renderMeshToDataURL(mesh, size * 2)));
    return () => cancelAnimationFrame(id);
  }, [mesh, size]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? '3D 보기' : undefined}
      className="rounded bg-secondary overflow-hidden block hover:ring-2 hover:ring-primary transition-shadow"
      style={{ width: size, height: size }}
    >
      {url && <img src={url} alt="" width={size} height={size} className="w-full h-full object-contain" />}
    </button>
  );
}