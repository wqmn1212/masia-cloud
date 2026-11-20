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

export function PcbStudioMock({ zh }) {
  return (
    <Frame title={L(zh, 'PCB 아트웍 스튜디오', 'PCB布线图工作室')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '기판 파일 열기', '打开PCB文件')}</Btn><span className="text-muted-foreground">renight-l1.kicad_pcb · zip</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Badge>{L(zh, '고르기 S', '选择 S')}</Badge><Badge tone="blue">{L(zh, '배선 X', '布线 X')}</Badge><Badge>{L(zh, '비아', '过孔')}</Badge><span className="text-muted-foreground">F.Cu · {L(zh, '폭', '线宽')} 0.25 mm · R · F · V · Ctrl+Z</span></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="space-y-0.5 p-1"><div className="text-destructive">{L(zh, '● T1 1번(GND) 연결이 약함 — 1.2 mm 상당 < 필요 1.37 mm (3 A)', '● T1 1脚(GND)连接较弱 — 相当1.2 mm < 需要1.37 mm (3 A)')}</div><div className="text-warning-text">{L(zh, '● 구멍 사이가 좁음 0.42 mm', '● 孔间距过小 0.42 mm')}</div></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span>GND · {L(zh, '접지', '地')} · 0 V · <b>3 A</b></span><span className="text-muted-foreground">+5V · {L(zh, '전원', '电源')} · 5 V · 1.2 A</span></div></Mark>
      <Mark n={5} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '시뮬레이션', '仿真')}</Btn><span>{L(zh, '강하 1.1 mV · 스포크 J2 2번 +3.6 °C', '压降 1.1 mV · 辐条 J2 2脚 +3.6 °C')}</span></div></Mark>
      <Mark n={6} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>.kicad_pcb</Btn><Btn>{L(zh, '검토 보고서', '检查报告')}</Btn><Btn primary>{L(zh, '시제품 파일에 저장', '保存到样机文件')}</Btn></div></Mark>
    </Frame>
  );
}

export function WbConcept3dMock({ zh }) {
  return (
    <Frame title={L(zh, '시제품 → 컨셉 스튜디오 → 3D 편집', '样机 → 概念工作室 → 3D编辑')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Badge tone="blue">{L(zh, '이동 W', '移动 W')}</Badge><Badge>{L(zh, '회전 E', '旋转 E')}</Badge><Badge>{L(zh, '크기 R', '缩放 R')}</Badge><span className="text-muted-foreground">{L(zh, '다이얼 · 가로 20 · 높이 14 mm', '旋钮 · 宽 20 · 高 14 mm')}</span><Btn primary>{L(zh, '새 버전으로 저장', '保存为新版本')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span>{L(zh, '대상: 다이얼 — “지름 20mm 로, 오른쪽 뒤로”', '对象：旋钮 — “直径改为20mm，移到右后方”')}</span><Btn>{L(zh, '새 버전 만들기', '生成新版本')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="space-y-0.5 p-1"><div><Badge tone="green">✓</Badge> {L(zh, '제품 전체 가로 180 mm ±1 · 지금 180', '整体宽 180 mm ±1 · 当前 180')}</div><div className="text-destructive">{L(zh, '⚠ 제품 전체 높이 160 mm · 지금 172 (+12)', '⚠ 整体高 160 mm · 当前 172 (+12)')}</div><Btn>{L(zh, '어긋난 치수 맞추기', '调整不符尺寸')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '지금 3D 화면으로 렌더', '按当前3D画面渲染')}</Btn></div></Mark>
      <Mark n={5} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span className="inline-block h-6 w-10 rounded border-2 border-destructive bg-destructive/20" /><span>{L(zh, '버튼을 무광 금색으로', '按钮改为哑光金色')}</span><Btn>{L(zh, '이 부분 다시 그리기', '重绘此部分')}</Btn><span className="text-muted-foreground">{L(zh, '예전 렌더 3', '旧渲染 3')}</span></div></Mark>
    </Frame>
  );
}

export function WbDemoMock({ zh }) {
  return (
    <Frame title={L(zh, '고객 화면 → 3D · 시연', '客户画面 → 3D · 演示')} badge={Ex(zh)}>
      <Mark n={1}><div className="relative h-16 rounded bg-foreground p-1"><span className="absolute left-[40%] top-[18%] h-10 w-10 rounded-full bg-warning shadow-[0_0_18px_6px_hsl(var(--warning)/0.55)]" /><span className="absolute left-1 top-1 rounded bg-white/85 px-1 text-[9px]">{L(zh, '따뜻한 빛 60 % · 22:25', '暖光 60 % · 22:25')}</span></div><div className="p-1">{L(zh, '시연 6 / 9 · 잠들 때 — 23:00 전 30분 서서히 어둡게', '演示 6 / 9 · 入睡 — 23:00 前30分钟渐暗')}</div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '어두운 방', '暗房')}</Btn><Badge>{L(zh, '1. 켜기', '1. 开灯')}</Badge><Badge tone="blue">{L(zh, '6. 잠들 때', '6. 入睡')}</Badge><Badge>{L(zh, '7. 일어날 때', '7. 起床')}</Badge></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '켜기', '开灯')}</Btn><Badge>{L(zh, '따뜻한 빛 · 밝은 빛 · 모두 함께', '暖光 · 亮光 · 一起')}</Badge><span className="text-muted-foreground">{L(zh, '밝기 60 %', '亮度 60 %')}</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Badge tone="blue">{L(zh, '시연', '演示')}</Badge><Badge>{L(zh, '상세 시뮬레이션', '详细仿真')}</Badge><span className="text-muted-foreground">{L(zh, '워크벤치: 고객 시연 미리보기', '工作台：客户演示预览')}</span></div></Mark>
      <Mark n={5} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '3D 실시간 리뷰 방', '3D实时评审室')}</Btn><Btn primary>{L(zh, '공유 → 링크 + PIN', '共享 → 链接 + PIN')}</Btn></div></Mark>
    </Frame>
  );
}

export function TeardownMock({ zh }) {
  return (
    <Frame title={L(zh, '컨셉 스튜디오 · 워크벤치 → 작동 원리', '概念工作室 · 工作台 → 工作原理')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '외형 3D', '外形3D')}</Btn><Btn>{L(zh, '3D 편집', '3D编辑')}</Btn><Btn primary>{L(zh, '작동 원리', '工作原理')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="space-y-0.5 p-1"><div className="font-semibold">{L(zh, '8 / 10 패브릭 발광면', '8 / 10 织物发光面')}</div><div className="text-muted-foreground">{L(zh, '제어 기판은 패브릭 발광면을 PWM 으로 켜고 밝기를 조절합니다.', '控制板用PWM点亮织物发光面并调节亮度。')}</div><div className="flex flex-wrap gap-1"><Badge tone="amber">{L(zh, '전원', '电源')}</Badge><Badge tone="blue">{L(zh, '신호', '信号')}</Badge><Badge>{L(zh, '빛', '光')}</Badge></div></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Badge>{L(zh, '실물', '实物')}</Badge><Badge tone="blue">{L(zh, '투명 외장', '透明外壳')}</Badge><Badge>{L(zh, '단면', '剖面')}</Badge><span className="text-muted-foreground">{L(zh, '분해 ━━○ · 이름표', '分解 ━━○ · 标签')}</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span className="text-muted-foreground">{L(zh, '“수면 모드 위주로”', '“以睡眠模式为主”')}</span><Btn primary>{L(zh, 'AI 로 투어 쓰기', '用AI编写导览')}</Btn><Btn>{L(zh, '기본 투어로', '恢复默认导览')}</Btn></div></Mark>
      <Mark n={5} className="mt-1.5"><div className="space-y-0.5 p-1"><div>{L(zh, 'Q. 밝기는 어떻게 바꿔요?', 'Q. 亮度怎么调？')}</div><div className="text-muted-foreground">{L(zh, '다이얼을 돌리면 제어 기판이 LED 판 밝기를 바꿉니다. · 근거: 다이얼', '转动旋钮，控制板改变LED板亮度。· 依据：旋钮')}</div></div></Mark>
      <Mark n={6} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, 'HTML 파일', 'HTML文件')}</Btn><Btn>{L(zh, '투어 영상', '导览视频')}</Btn></div></Mark>
    </Frame>
  );
}

export function WbCardMock({ zh }) {
  return (
    <Frame title={L(zh, '개발 워크벤치 맨 위 · 업무 카드 “지금” 탭', '开发工作台顶部 · 业务卡片“当前”页')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Badge tone="blue">{L(zh, '무드등 개발', '氛围灯开发')}</Badge><Btn>{L(zh, '바꾸기', '更换')}</Btn><Btn>{L(zh, '새 카드 만들기', '新建卡片')}</Btn><Btn>{L(zh, '연결 풀기', '解除关联')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="space-y-0.5 p-1"><div className="font-semibold">{L(zh, '무니스 스마트 조명 · RENIGHT-S1', 'Munice 智能灯 · RENIGHT-S1')}</div><div>{L(zh, '컨셉 v3 · 확정본 v1 · 설계 변경 진행 1 / 2 · 공장 시험 합격 12/12', '概念 v3 · 定版 v1 · 设计变更进行中 1 / 2 · 工厂测试合格 12/12')}</div></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="p-1 text-muted-foreground">{L(zh, '[시제품 · 무니스 스마트 조명] 설계 확정본 v1 을 만들었습니다 · 개발 워크벤치', '[样机 · Munice 智能灯] 已生成设计定版 v1 · 开发工作台')}</div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '시제품 연결', '关联样机')}</Btn><Btn>{L(zh, '새 시제품', '新建样机')}</Btn></div></Mark>
    </Frame>
  );
}

export function DesignRoomMock({ zh }) {
  return (
    <Frame title={L(zh, '디자인 실시간 리뷰 · 박스 인쇄 시안', '设计实时评审 · 包装印刷稿')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '리뷰 방 열기', '打开评审室')}</Btn><span className="text-muted-foreground">{L(zh, '카드 파일 탭 · 이미지·PDF', '卡片文件页 · 图片·PDF')}</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="relative h-14 rounded bg-destructive/80 p-1"><span className="absolute left-[30%] top-[30%] flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">1</span><span className="absolute left-[62%] top-[52%] rounded bg-primary px-1 text-[9px] text-white">{L(zh, '▲ 박디자이너', '▲ 朴设计师')}</span></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '댓글 (C)', '评论 (C)')}</Btn><span>{L(zh, '① 로고 2mm 위로 · 답글 · 해결', '① Logo上移2mm · 回复 · 解决')}</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '공유', '共享')}</Btn><span className="font-mono">PIN 482913</span><span className="text-muted-foreground">{L(zh, '이메일 초대 2명', '邮件邀请 2人')}</span></div></Mark>
    </Frame>
  );
}

export function SalesMock({ zh }) {
  return (
    <Frame title={L(zh, '영업 파이프라인', '销售管道')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '엑셀 목록 붙여넣기', '粘贴Excel列表')}</Btn><Btn primary>{L(zh, '영업 대상 추가', '添加销售对象')}</Btn><span className="text-muted-foreground">{L(zh, '오늘 연락할 곳 2', '今天要联系 2')}</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span>{L(zh, '1차 팔로업 · 제목: 지난번 드린 제안 관련', '第1次跟进 · 标题：关于上次的提案')}</span><Btn>{L(zh, '복사', '复制')}</Btn><Btn primary>{L(zh, '보냈다고 기록', '记录已发送')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Badge>{L(zh, '통화', '通话')}</Badge><span>{L(zh, '11-16 담당자와 통화 · 다음 연락 11-18', '11-16 与负责人通话 · 下次联系 11-18')}</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '수주 → 업무 카드', '成交 → 任务卡片')}</Btn><Btn>{L(zh, '보류', '搁置')}</Btn></div></Mark>
    </Frame>
  );
}

export function ClientRequestStaffMock({ zh }) {
  return (
    <Frame title={L(zh, '고객 자료 요청 · 디자인 전달 자료', '客户资料请求 · 设计交接资料')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '자료 요청 보내기', '发送资料请求')}</Btn><span className="text-muted-foreground">{L(zh, '서식 · 항목 6 · 기한 11-20', '模板 · 6项 · 期限 11-20')}</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><span>{L(zh, '각도별 이미지', '各角度图片')}</span><Badge>{L(zh, '확인 필요', '待确认')}</Badge><span className="text-muted-foreground">{L(zh, '정면.png · 측면.png', '正面.png · 侧面.png')}</span></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '확인', '确认')}</Btn><Btn>{L(zh, '다시 요청', '要求重发')}</Btn><span className="h-1.5 w-16 rounded bg-primary/30"><span className="block h-1.5 w-8 rounded bg-primary" /></span><span>3/6</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '마감', '截止')}</Btn></div></Mark>
    </Frame>
  );
}

export function MeetingBriefMock({ zh }) {
  return (
    <Frame title={L(zh, '미팅 준비 · 무니스 수면 조명', '会议准备 · 睡眠灯项目')} badge={Ex(zh)}>
      <Mark n={1}><div className="space-y-0.5 p-1"><p className="font-semibold">{L(zh, '고객에게 물어볼 것 2', '要问客户的 2')}</p><p>{L(zh, '부품별 3D 파일 · 11-20까지', '分件3D文件 · 11-20前')}</p><p className="font-semibold">{L(zh, '우리가 답할 것 3', '我们要答复的 3')}</p><p className="text-destructive">{L(zh, '렌더 수정 · 11-12 지남', '渲染修改 · 11-12 已过')}</p></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn>{L(zh, '안건 복사', '复制议程')}</Btn><Btn>{L(zh, '인쇄·PDF', '打印·PDF')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Btn primary>{L(zh, '이 안건으로 미팅 기록 시작', '以此议程开始会议记录')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="space-y-0.5 p-1 font-mono text-[10px]"><p>[길상현] [오후 2:14] 버튼은 뒤쪽으로</p><p>[이호민] [오후 2:15] 월요일까지 수정안</p><Btn>{L(zh, 'AI 분석', 'AI分析')}</Btn></div></Mark>
    </Frame>
  );
}

export function MarketingPublishMock({ zh }) {
  return (
    <Frame title={L(zh, '마케팅 관리 · 게시물 편집', '营销管理 · 编辑帖子')} badge={Ex(zh)}>
      <Mark n={1}><div className="flex flex-wrap items-center gap-1 p-1"><span>{L(zh, '11/20 (금) 10:00', '11/20 (五) 10:00')}</span><Btn>{L(zh, '예약', '预约')}</Btn><span className="text-muted-foreground">☑ {L(zh, '예약 시각에 자동으로 올리기', '在预约时间自动发布')}</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="p-1"><Btn primary>{L(zh, '지금 인스타그램에 올리기', '立即发布到Instagram')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1 text-destructive"><span>{L(zh, '게시 실패 (1회): 사진 주소를 열 수 없습니다', '发布失败(1次)：无法打开图片链接')}</span><Btn>{L(zh, '다시 시도', '重试')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><Field label={L(zh, '유튜브 게시물 URL', 'YouTube帖子URL')} value="https://youtu.be/…" /><Btn>{L(zh, '게시 완료로 표시', '标记为已发布')}</Btn></div></Mark>
    </Frame>
  );
}
