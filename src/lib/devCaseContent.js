// 개발 사례 (가상 예시) — 메인페이지와 포트폴리오에 함께 쓴다. [ko, en, zh]
// 실제 고객 사례가 아니다. 화면에 항상 "가상 예시" 표시와 안내 문구를 함께 보여 준다.
export const devCase = {
  eyebrow: 'CASE STUDY — EXAMPLE',
  badge: ['가상 예시', 'Fictional example', '虚构示例'],
  h2: ['한 문장 아이디어가 양산 제품이 되기까지', 'How a one-line idea becomes a mass-produced product', '一句话创意如何成为量产产品'],
  sub: [
    '컨셉 스튜디오의 미니 공기청정기를 예로, AEGIS가 개발부터 양산까지 진행하는 흐름을 보여 드립니다.',
    'Using the mini air purifier from our Concept Studio, here is how AEGIS takes a product from development to mass production.',
    '以概念工作室中的迷你空气净化器为例，展示 AEGIS 从开发到量产的推进流程。',
  ],
  product: ['책상용 원통형 미니 공기청정기', 'Cylindrical desktop mini air purifier', '桌面圆柱形迷你空气净化器'],
  facts: [
    { k: ['시작', 'Starting point', '起点'], v: ['“책상 위에 두는 원통형 미니 공기청정기” 한 문장', 'One sentence: “a small cylindrical air purifier for the desk”', '一句话：“放在桌上的圆柱形迷你空气净化器”'] },
    { k: ['담당', 'Team', '负责团队'], v: ['한국 개발팀 · 중국 현지 개발·생산팀 · 협력 공장 개발팀', 'Korea dev team · China dev & production team · partner factory engineers', '韩国开发团队 · 中国本地开发生产团队 · 合作工厂开发团队'] },
    { k: ['기간', 'Timeline', '周期'], v: ['약 17주 · 첫 양산 1,000대', 'About 17 weeks · first run of 1,000 units', '约 17 周 · 首批量产 1,000 台'] },
  ],
  pointLabel: ['양산 포인트', 'For production', '量产要点'],
  stages: [
    { w: ['1주', 'Week 1', '第 1 周'], t: ['요구사항 정리', 'Requirements', '需求整理'], d: ['목표 판매가, 필터 등급, 소음 기준, USB-C 전원 조건을 정리했습니다.', 'We set the target retail price, filter grade, noise limit and USB-C power.', '整理了目标售价、滤网等级、噪音标准与 USB-C 供电条件。'], p: ['목표 단가에서 거꾸로 부품별 예산을 나눴습니다.', 'Part budgets were worked back from the target unit cost.', '从目标单价倒推各零件预算。'] },
    { w: ['2–4주', 'Weeks 2–4', '第 2–4 周'], t: ['컨셉 · 설계', 'Concept & design', '概念与设计'], d: ['3D 컨셉으로 외형을 정하고, 한국 · 중국 개발팀이 기구와 회로를 함께 설계했습니다.', 'The look was fixed with a 3D concept, then our Korea and China teams designed the mechanics and circuit together.', '用 3D 概念确定外观，再由韩中开发团队共同设计结构与电路。'], p: ['외장을 2피스로 나눠 금형 수를 줄이고, 팬은 표준 부품으로 골랐습니다.', 'A two-piece shell cut the number of moulds, and a standard fan was chosen.', '外壳分为两件以减少模具数量，风扇选用标准件。'] },
    { w: ['5–8주', 'Weeks 5–8', '第 5–8 周'], t: ['시제품 · 시험', 'Prototype & testing', '样机与测试'], d: ['중국 현지에서 시제품을 2차까지 만들어 풍량 · 소음 · 발열을 시험했습니다.', 'Two prototype rounds were built in China and tested for airflow, noise and heat.', '在中国当地制作了两轮样机，测试风量、噪音与发热。'], p: ['1차 시험의 진동 소음을 팬 고정 구조 보강으로 해결했습니다.', 'Vibration noise from round one was fixed by reinforcing the fan mount.', '通过加固风扇固定结构，解决了第一轮测试中的振动噪音。'] },
    { w: ['9–10주', 'Weeks 9–10', '第 9–10 周'], t: ['공장 선정 · 원가 확정', 'Factory & cost', '选定工厂与确定成本'], d: ['협력 공장 세 곳의 견적을 같은 사양으로 비교하고, 한국 도착 원가로 확정했습니다.', 'Three partner factories quoted the same spec, and the price was fixed on landed cost in Korea.', '三家合作工厂按同一规格报价比较，并以韩国落地成本确定价格。'], p: ['공장 개발팀과 사출 조건 · 조립 순서를 미리 맞췄습니다.', 'Moulding conditions and assembly order were agreed with the factory engineers up front.', '与工厂开发团队提前对齐注塑条件与组装顺序。'] },
    { w: ['11–16주', 'Weeks 11–16', '第 11–16 周'], t: ['금형 · 초도 샘플', 'Tooling & first shots', '模具与首批样品'], d: ['금형을 만들고 초도 샘플로 치수 · 외관을 확인한 뒤 한 번 수정했습니다.', 'Moulds were built, and first-shot samples checked for dimensions and finish, with one round of correction.', '制作模具并用首批样品确认尺寸与外观，修模一次。'], p: ['설계 단계에서 구배 · 살 두께를 잡아 둬서 금형 수정이 한 번에 끝났습니다.', 'Draft and wall thickness were set at the design stage, so one correction was enough.', '设计阶段已确定拔模斜度与壁厚，修模一次即完成。'] },
    { w: ['17주~', 'Week 17 on', '第 17 周起'], t: ['양산 · QC · 출하', 'Production, QC & shipping', '量产 · QC · 出货'], d: ['첫 양산 1,000대를 생산하고, 전 수량 기능 검사와 시리얼별 검사 기록을 남긴 뒤 출하했습니다.', 'The first 1,000 units were produced, every unit function-tested with a serial-level record, then shipped.', '首批生产 1,000 台，全数功能检测并按序列号留存检验记录后出货。'], p: ['출고 전 검수 사진 · 영상을 AEGIS Cloud로 공유했습니다.', 'Pre-shipment inspection photos and video were shared in AEGIS Cloud.', '出货前检验照片与视频通过 AEGIS Cloud 共享。'] },
  ],
  note: [
    '설명을 위한 가상 제품입니다. 실제 일정 · 비용 · 공정은 제품마다 다릅니다.',
    'A fictional product for illustration. Real schedules, costs and processes vary by product.',
    '此为用于说明的虚构产品。实际日程、费用与工艺因产品而异。',
  ],
};
