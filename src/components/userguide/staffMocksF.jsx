import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

// 제품 개발 워크벤치 예시 화면 (금형용 3D · 회로·기판 · 펌웨어 · 확정·원가 · 미팅 모드 · 출하 검사).
// Mark 개수 = userGuideContent 의 points 개수.
const L = (zh, ko, cn) => (zh ? cn : ko);
const Ex = (zh) => L(zh, '예시 화면', '示例画面');

export function WbMoldMock({ zh }) {
  return (
    <Frame title={L(zh, '시제품 → 개발 워크벤치 → 3D 도면 → 금형용 설계', '样机 → 开发工作台 → 3D图纸 → 模具设计')} badge={Ex(zh)}>
      <Mark n={1}><div className="grid grid-cols-3 gap-1 p-1"><Field label={L(zh, '외장 형태', '外壳形式')} value={L(zh, '원형 양면 조명', '圆形双面灯')} /><Field label={L(zh, '본체 지름', '主体直径')} value="150 mm" /><Field label={L(zh, '살두께 · 구배', '壁厚 · 拔模')} value="2 mm · 2°" /></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap gap-1 p-1"><Badge tone="green">{L(zh, '조립 간섭 없음', '装配无干涉')}</Badge><Badge tone="blue">{L(zh, '기판 부품 48개 포함', '含PCB元件48个')}</Badge><Badge tone="amber">{L(zh, '받침대: 슬라이드 4', '底座：滑块4')}</Badge></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '조립 STEP', '装配STEP')}</Btn><Btn>{L(zh, '금형 업체용 묶음', '模具厂资料包')}</Btn><Btn primary>{L(zh, '공장에 금형 견적 요청', '向工厂询模具价')}</Btn></div></Mark>
    </Frame>
  );
}

export function WbBoardMock({ zh }) {
  return (
    <Frame title={L(zh, '개발 워크벤치 → 회로 설계', '开发工作台 → 电路设计')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap gap-1 p-1"><Badge tone="blue">{L(zh, '제어 기판 · 52', '主控板 · 52')}</Badge><Badge>{L(zh, 'LED 구동 기판 · 33', 'LED驱动板 · 33')}</Badge><span className="text-muted-foreground">{L(zh, 'LED 구동부를 별도 기판으로', 'LED驱动单独成板')}</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap gap-1 p-1"><Btn>{L(zh, 'KiCad 프로젝트', 'KiCad工程')}</Btn><Btn>{L(zh, '기판 외곽 DXF', 'PCB外形DXF')}</Btn><Btn>{L(zh, 'JLCPCB 부품표', 'JLCPCB物料表')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex items-center gap-1 p-1"><span className="font-mono">J6</span><span className="flex-1 text-muted-foreground">SM06B-SRSS-TB</span><span className="rounded border px-1.5 font-mono text-muted-foreground">{L(zh, 'C번호', 'C编号')}</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="space-y-0.5 p-1"><Btn primary>{L(zh, '자동 배선하고 제조 파일 만들기', '自动布线并生成制造文件')}</Btn><div className="text-muted-foreground">{L(zh, '선 818 · 비아 105 · 남은 미연결 3 · 손으로 이을 곳 목록', '走线818 · 过孔105 · 未连接3 · 需手工连接清单')}</div></div></Mark>
    </Frame>
  );
}

export function WbFirmwareMock({ zh }) {
  return (
    <Frame title={L(zh, '개발 워크벤치 → 블루투스·앱', '开发工作台 → 蓝牙·App')} badge={Ex(zh)}>
      <Mark n={1}><div className="space-y-1 p-1"><b>{L(zh, '바로 굽기 (공용 펌웨어)', '直接烧录（通用固件）')}</b><div className="flex flex-wrap gap-1"><Btn primary>{L(zh, '공용 펌웨어 굽고 설정 넣기', '烧录通用固件并写入配置')}</Btn><Btn>{L(zh, '설정만 써 넣기', '仅写入配置')}</Btn></div></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap gap-1 p-1"><Btn>{L(zh, '빌드 서버에서 컴파일', '在构建服务器编译')}</Btn><Btn>{L(zh, 'USB 로 굽기', 'USB烧录')}</Btn><Btn>{L(zh, '시리얼 모니터', '串口监视器')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="space-y-0.5 p-1"><div>{L(zh, '전면 LED 판 온도 · 원시 25.5 °C → 보정 후 24.0 °C', '前LED板温度 · 原始 25.5 °C → 校准后 24.0 °C')} <Badge tone="green">{L(zh, '저장됨', '已保存')}</Badge></div><div className="text-muted-foreground">{L(zh, '응답 시간 평균 42 ms · 장치 시각 맞춤', '响应时间平均 42 ms · 已校准设备时间')}</div></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span>{L(zh, '무선 펌웨어 업데이트', '无线固件升级')}</span><Btn>{L(zh, '펌웨어 파일 고르기', '选择固件文件')}</Btn><Btn primary>{L(zh, '장치에 보내기', '发送到设备')}</Btn><Btn>{L(zh, 'iOS·Android 코드 받기', '下载iOS·Android代码')}</Btn></div></Mark>
    </Frame>
  );
}

export function WbFreezeMock({ zh }) {
  return (
    <Frame title={L(zh, '개발 워크벤치 → 시험·양산', '开发工作台 → 测试·量产')} badge={Ex(zh)}>
      <Mark n={1}><div className="p-1"><b>{L(zh, '확정본 v1', '定版 v1')}</b> · 2026-11-15 <div className="text-muted-foreground">{L(zh, '확정본 뒤로 바뀐 점 2건: [외장] 본체–받침대 갭 4 → 6 mm', '定版后的变更2项：[外壳] 主体与底座间隙 4 → 6 mm')}</div></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span className="font-semibold">ECO-001</span><Badge tone="amber">{L(zh, '고객 확인 대기', '等待客户确认')}</Badge><Btn>{L(zh, '고객 통지서 만들기', '生成客户通知书')}</Btn><Btn primary>{L(zh, '승인하고 새 확정본', '批准并生成新定版')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="space-y-0.5 p-1"><div className="flex justify-between"><span>{L(zh, '1,000개', '1,000个')}</span><b>{L(zh, '개당 42,587원', '单件 42,587韩元')}</b></div><div className="text-muted-foreground">{L(zh, '앞 하우징 금형 8,190,000원 (견적, 추정 7,000,000원)', '前壳模具 8,190,000韩元（报价，估算 7,000,000）')}</div><Btn>{L(zh, '견적서 파일 읽기', '读取报价文件')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="p-1"><b>{L(zh, '실물 시제품 검증', '实物样机验证')}</b> <Badge tone="green">{L(zh, '14/21 통과', '14/21 通过')}</Badge> <Badge tone="red">{L(zh, '불합격 1', '不合格 1')}</Badge><div className="text-muted-foreground">{L(zh, '블루투스 거리 2 m 에서 끊김 (금속 힌지)', '蓝牙距离2 m断开（金属铰链）')}</div></div></Mark>
    </Frame>
  );
}

export function WbMeetingMock({ zh }) {
  return (
    <Frame title={L(zh, '개발 워크벤치 → 미팅 모드', '开发工作台 → 会议模式')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap gap-1 p-1">{[['스케치·컨셉', '草图·概念'], ['금형용 3D', '模具3D'], ['기능', '功能'], ['회로·기판', '电路·PCB']].map(([k, c], i) => <Badge key={k} tone={i < 3 ? 'green' : undefined}>{L(zh, k, c)}</Badge>)}<Btn primary>{L(zh, '다음: 회로 설계', '下一步：电路设计')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="grid grid-cols-2 gap-1 p-1"><Field label={L(zh, '결정 사항', '决定事项')} value={L(zh, '갭 6 mm 로 늘린다', '间隙加大到6 mm')} /><Field label={L(zh, '할 일', '待办')} value={L(zh, '금형 견적 3곳 요청', '向3家询模具价')} /></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap gap-1 p-1"><Btn>{L(zh, '미팅 결과 요약', '会议结果摘要')}</Btn><Btn>{L(zh, '인증 준비 자료', '认证准备资料')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="space-y-0.5 p-1"><Btn primary>{L(zh, '고객과 공유', '与客户共享')}</Btn><div className="text-muted-foreground">PIN 482913 · {L(zh, '결정 2건 중 1건 확인 — 홍길동', '2项决定中已确认1项 — 洪吉童')}</div></div></Mark>
    </Frame>
  );
}

export function WbFactoryTestMock({ zh }) {
  return (
    <Frame title={L(zh, '시험·양산 → 출하 검사대', '测试·量产 → 出货检验台')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap gap-1 p-1"><Btn primary>{L(zh, 'USB 연결', '连接USB')}</Btn><Btn>{L(zh, '이 기기에 굽기', '烧录到此设备')}</Btn><Btn>{L(zh, '검사 시작', '开始检测')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="space-y-0.5 p-1"><div>✓ {L(zh, '펌웨어 버전', '固件版本')} <span className="font-mono text-muted-foreground">0.2.0</span></div><div>✓ {L(zh, '전면 LED 판 온도: 5~45 °C', '前LED板温度：5~45 °C')} <span className="font-mono text-muted-foreground">24.8 °C</span></div></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span className="flex-1">{L(zh, '전면 기상등이 켜졌나요?', '「前灯」是否点亮？')}</span><Btn>{L(zh, '켜기', '打开')}</Btn><Btn primary>{L(zh, '정상', '正常')}</Btn><Btn>{L(zh, '불량', '不良')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="p-1 text-center"><div className="text-base font-black text-accent">{L(zh, '합격', '合格')}</div><div className="font-mono">SN-261115-001</div><Btn primary>{L(zh, '기록 저장 · 다음', '保存记录 · 下一台')}</Btn></div></Mark>
    </Frame>
  );
}

export function WbClientShareMock({ zh }) {
  return (
    <Frame title={L(zh, '시험·양산 → 고객 공유', '测试·量产 → 客户共享')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><span className="flex-1">{L(zh, '3D·동작 시뮬레이션', '3D·动作仿真')} <Badge tone="green">{L(zh, '공개 중', '公开中')}</Badge></span><Btn primary>{L(zh, '지금 설계로 갱신', '按当前设计更新')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="space-y-0.5 p-1"><div>{L(zh, '명판·라벨 문구', '铭牌·标签文字')} <Badge>{L(zh, 'v1 수정 요청', 'v1 要求修改')}</Badge></div><div className="text-muted-foreground">{L(zh, '김담당: 제조국 표기 추가', '金经理：增加制造国标注')}</div><Btn>{L(zh, '고친 내용으로 다시 요청 (v2)', '按修改内容再次请求 (v2)')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="space-y-0.5 p-1"><div>ECO-001 · {L(zh, '구배 2° → 3°', '拔模 2° → 3°')}</div><div className="text-accent">{L(zh, '고객 포털: 고객 승인 · 김담당', '客户门户：客户已批准 · 金经理')}</div><Btn primary>{L(zh, '승인하고 새 확정본', '批准并生成新定版')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span className="flex-1">{L(zh, '다이얼 버튼 · 조금 더 컸으면', '旋钮 · 希望再大一点')}</span><Btn>{L(zh, '처리함', '已处理')}</Btn></div></Mark>
    </Frame>
  );
}
