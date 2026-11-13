import React, { useMemo } from 'react';
import { Bluetooth, FileCode2, FileText, Smartphone, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CopyButton, DownloadButton, CodeView, CommandLine } from '@/components/prototype/develop/DevBits';
import BleTester from '@/components/prototype/develop/BleTester';
import { buildGatt, pinUuids, firmwareSketch, protocolDoc, randomBase, bytesHex, encodeValue, TYPE_LABEL } from '@/lib/devkit/ble';
import { MCUS } from '@/lib/devkit/features';

const ACCESS = { read: '읽기', write: '쓰기', notify: '알림' };

// 5단계: 블루투스 통신 규격 → ESP32 펌웨어 뼈대 → 앱 개발팀 문서 → 웹 블루투스로 실제 장치 시험
export default function BleStep({ project, dev, change, dirty }) {
  const ready = !!dev.uuid_base;
  const fixed = useMemo(() => (ready ? pinUuids(dev) : null), [dev, ready]);
  const gatt = useMemo(() => (fixed ? buildGatt(fixed) : null), [fixed]);
  const fw = useMemo(() => (fixed ? firmwareSketch(fixed) : ''), [fixed]);
  const doc = useMemo(() => (fixed ? protocolDoc(fixed, { title: project.title }) : ''), [fixed, project.title]);
  const base = dev.device_name || 'device';

  if (!(dev.features || []).length) return <Card title="블루투스·앱" icon={Bluetooth}><p className="text-caption text-muted-foreground">3단계에서 기능을 먼저 추가하세요. 기능마다 앱에서 읽고 쓰는 블루투스 항목이 하나씩 생깁니다.</p></Card>;
  if (!ready) {
    return (
      <Card title="블루투스 UUID 만들기" icon={KeyRound}>
        <p className="text-caption text-muted-foreground">이 제품만의 서비스 UUID 를 만들고 기능마다 특성 UUID 를 붙입니다. 저장하면 고정되어, 기능 이름·순서를 바꿔도 앱과 펌웨어가 계속 맞습니다.</p>
        <Button size="sm" onClick={() => change({ uuid_base: randomBase() })}><KeyRound className="w-4 h-4" />UUID 만들기</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dirty && <p className="rounded-lg bg-warning/10 px-4 py-2 text-caption text-warning-text">저장하지 않은 변경이 있습니다. 펌웨어·문서를 내보내기 전에 ‘설정 저장’을 눌러 UUID 를 고정하세요.</p>}
      <Card title="통신 규격 (GATT)" icon={Bluetooth} tag={gatt.device_name}>
        <div className="grid gap-2 text-caption sm:grid-cols-2">
          <CommandLine label="서비스 UUID" cmd={gatt.service} />
          <CommandLine label="펌웨어 버전 (읽기)" cmd={gatt.info.uuid} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-caption">
            <thead className="text-left text-muted-foreground"><tr><th className="py-1.5 pr-2 font-medium">#</th><th className="py-1.5 pr-2 font-medium">기능</th><th className="py-1.5 pr-2 font-medium">특성 UUID</th><th className="py-1.5 pr-2 font-medium">동작</th><th className="py-1.5 pr-2 font-medium">형식</th><th className="py-1.5 pr-2 font-medium">값</th><th className="py-1.5 font-medium">예 (바이트)</th></tr></thead>
            <tbody>
              {gatt.chars.map((c) => {
                const ex = c.type === 'bytes' ? null : c.kind === 'temp' ? 25.3 : Math.min(c.max, c.max > 1 ? 50 : 1);
                return (
                  <tr key={c.uuid} className="border-t align-top">
                    <td className="py-1.5 pr-2 tabular-nums">{c.index}</td>
                    <td className="py-1.5 pr-2 font-medium">{c.name}{Number.isInteger(c.pin) && <span className="block text-micro font-normal text-muted-foreground">GPIO{c.pin}</span>}</td>
                    <td className="py-1.5 pr-2 font-mono text-micro">{c.uuid}</td>
                    <td className="py-1.5 pr-2">{c.access.map((a) => ACCESS[a]).join('·')}</td>
                    <td className="py-1.5 pr-2" title={TYPE_LABEL[c.type]}>{c.type}{c.scale !== 1 ? ` ×${c.scale}` : ''}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{c.desc}</td>
                    <td className="py-1.5 font-mono text-micro">{ex == null ? '자유' : `${ex} → ${bytesHex(encodeValue(c, ex))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ESP32 펌웨어 뼈대" icon={FileCode2} tag={(MCUS[dev.mcu] || MCUS.esp32c3).board}
          actions={<><CopyButton text={fw} /><DownloadButton text={fw} name={`${base}.ino`} variant="default" /></>}>
          <p className="text-caption text-muted-foreground">Arduino IDE (ESP32 보드 패키지 3.x) 에서 바로 올릴 수 있는 스케치입니다. 핀 설정·블루투스 광고·쓰기 처리·센서 알림까지 들어 있고, 동작 로직은 TODO 자리에 덧붙입니다.</p>
          <CodeView text={fw} maxH="max-h-[440px]" />
        </Card>
        <Card title="앱 개발팀용 통신 문서" icon={FileText}
          actions={<><CopyButton text={doc} /><DownloadButton text={doc} name={`${base}-ble-protocol.md`} type="text/markdown" variant="default" /></>}>
          <p className="text-caption text-muted-foreground">고객사·외주 앱 개발팀에 넘기는 문서입니다. UUID 표, 값 형식, 연결 순서, Web Bluetooth·Flutter 예시 코드가 들어 있습니다.</p>
          <CodeView text={doc} maxH="max-h-[440px]" />
        </Card>
      </div>

      <Card title="장치 시험 (웹 블루투스)" icon={Smartphone}>
        <p className="text-caption text-muted-foreground">펌웨어를 올린 시제품에 이 화면에서 바로 연결해 값을 보내고 알림을 받습니다. 장치가 없으면 가상 장치로 앱 화면과 통신 흐름을 먼저 확인할 수 있습니다.</p>
        <BleTester gatt={gatt} />
      </Card>
    </div>
  );
}
