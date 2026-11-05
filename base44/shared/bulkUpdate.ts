// 여러 레코드를 한꺼번에 고친다. Base44 는 호출자마다 1분에 200건 남짓만 하나씩 고칠 수 있어서
// (성적서 1,000대·파레트 출하 수백 대를 하나씩 고치면 중간에 막힌다) bulkUpdate(한 번에 최대 500건)로 묶어 보낸다.
// rows: [{ id, ...고칠 칸 }]
export async function updateAll(entity: any, rows: any[], chunk = 200) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    if (typeof entity.bulkUpdate === 'function') await entity.bulkUpdate(part);
    else for (const { id, ...patch } of part) await entity.update(id, patch);
  }
  return rows.length;
}
