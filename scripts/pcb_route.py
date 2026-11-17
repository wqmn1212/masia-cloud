#!/usr/bin/env python3
# 기판 자동 배선·마무리 (KiCad 7 pcbnew 파이썬 + Freerouting)
#   python3 scripts/pcb_route.py board.kicad_pcb [freerouting.jar]
# 1) Specctra DSN 으로 내보내 Freerouting 으로 배선 → SES 를 읽어 트랙·비아를 넣는다 (KiCad 7 은 단독 실행에서 SES 가져오기를 못 해서 직접 읽는다)
# 2) 양면 GND 동박(존)을 깔고 채운다  3) DRC 보고서와 요약(summary.json)을 쓴다
import json, os, re, shutil, subprocess, sys
import pcbnew

MM = pcbnew.FromMM


def sexpr(text):
    tokens = re.findall(r'\(|\)|"[^"]*"|[^\s()]+', text)
    stack = [[]]
    for t in tokens:
        if t == '(':
            stack.append([])
        elif t == ')':
            done = stack.pop()
            stack[-1].append(done)
        else:
            stack[-1].append(t.strip('"'))
    return stack[0]


def find(node, head):
    return [c for c in node if isinstance(c, list) and c and c[0] == head]


def import_ses(board, ses_path):
    root = sexpr(open(ses_path, encoding='utf-8', errors='replace').read())[0]
    routes = find(root, 'routes')[0]
    res = find(routes, 'resolution')[0]  # (resolution um 10) → 1 단위 = 1/10 um
    unit = {'um': 1e-3, 'mm': 1.0, 'mil': 0.0254, 'inch': 25.4}[res[1]] / float(res[2])
    xy = lambda x, y: pcbnew.VECTOR2I(MM(float(x) * unit), MM(-float(y) * unit))
    layers = {board.GetLayerName(l): l for l in (pcbnew.F_Cu, pcbnew.B_Cu)}
    pad_sizes = {}
    for lib in find(routes, 'library_out'):
        for ps in find(lib, 'padstack'):
            name = ps[1]
            m = re.search(r'_(\d+):(\d+)_um', name)
            if m:
                pad_sizes[name] = (int(m.group(1)) / 1000.0, int(m.group(2)) / 1000.0)
    tracks = vias = 0
    for netout in find(routes, 'network_out'):
        for net in find(netout, 'net'):
            ni = board.FindNet(net[1])
            for w in find(net, 'wire'):
                for p in find(w, 'path'):
                    layer = layers.get(p[1])
                    if layer is None:
                        continue
                    width = float(p[2]) * unit
                    pts = p[3:]
                    for i in range(0, len(pts) - 2, 2):
                        t = pcbnew.PCB_TRACK(board)
                        t.SetStart(xy(pts[i], pts[i + 1]))
                        t.SetEnd(xy(pts[i + 2], pts[i + 3]))
                        t.SetWidth(MM(width))
                        t.SetLayer(layer)
                        if ni:
                            t.SetNet(ni)
                        board.Add(t)
                        tracks += 1
            for v in find(net, 'via'):
                d, drill = pad_sizes.get(v[1], (0.6, 0.3))
                via = pcbnew.PCB_VIA(board)
                via.SetPosition(xy(v[2], v[3]))
                via.SetWidth(MM(d))
                via.SetDrill(MM(drill))
                via.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
                if ni:
                    via.SetNet(ni)
                board.Add(via)
                vias += 1
    return tracks, vias


def add_gnd_pours(board):
    gnd = board.FindNet('GND')
    if not gnd:
        return 0
    bb = board.GetBoardEdgesBoundingBox()
    n = 0
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        z = pcbnew.ZONE(board)
        z.SetLayer(layer)
        z.SetNet(gnd)
        z.SetLocalClearance(MM(0.3))
        z.SetMinThickness(MM(0.25))
        z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
        z.SetIsRuleArea(False)
        o = z.Outline()
        o.NewOutline()
        for x, y in ((bb.GetLeft(), bb.GetTop()), (bb.GetRight(), bb.GetTop()), (bb.GetRight(), bb.GetBottom()), (bb.GetLeft(), bb.GetBottom())):
            o.Append(x, y)
        board.Add(z)
        n += 1
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    return n


def _rect(x0, y0, x1, y1):
    r = pcbnew.SHAPE_POLY_SET()
    r.NewOutline()
    for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
        r.Append(int(x), int(y))
    return r


def add_edge_keepout(board, margin=0.6):
    """기판 테두리(와 고정 구멍) 안쪽 margin mm 띠에 배선·비아 금지 구역을 둔다 (자동 배선이 테두리에 붙지 않게).
    DSN(Specctra) 은 구멍 있는 다각형을 금지 구역으로 내보내지 못하므로, 띠를 네 사분면으로 잘라 구멍 없는 조각마다 구역을 만든다.
    구역은 기판 파일에 남겨 둔다 (KiCad 에서 손으로 고칠 때도 같은 규칙이 걸린다. 동박 면은 막지 않는다)."""
    outline = pcbnew.SHAPE_POLY_SET()
    if not board.GetBoardPolygonOutlines(outline):
        return 0
    inner = pcbnew.SHAPE_POLY_SET(outline)
    inner.Inflate(MM(-margin), 16)
    bb = board.GetBoardEdgesBoundingBox()
    bb.Inflate(MM(2))
    l, t, r, btm = bb.GetLeft(), bb.GetTop(), bb.GetRight(), bb.GetBottom()
    cx, cy = (l + r) // 2, (t + btm) // 2
    cu = pcbnew.LSET()
    cu.AddLayer(pcbnew.F_Cu)
    cu.AddLayer(pcbnew.B_Cu)
    n = 0
    for q in (_rect(l, t, cx, cy), _rect(cx, t, r, cy), _rect(l, cy, cx, btm), _rect(cx, cy, r, btm)):
        # 기판 밖으로 나간 금지 구역은 DSN 에 실리지 않는다 → 기판 외곽 안쪽 띠만 남긴다
        # 바깥 외곽선만 쓴다 (고정 구멍 둘레는 구멍 없는 원판 조각으로 남는다)
        piece = pcbnew.SHAPE_POLY_SET()
        for oi in range(outline.OutlineCount()):
            piece.AddOutline(outline.Outline(oi))
        piece.BooleanIntersection(q, pcbnew.SHAPE_POLY_SET.PM_STRICTLY_SIMPLE)
        piece.BooleanSubtract(inner, pcbnew.SHAPE_POLY_SET.PM_STRICTLY_SIMPLE)
        for i in range(piece.OutlineCount()):
            if piece.HoleCount(i):
                continue
            z = pcbnew.ZONE(board)
            # 외곽선은 구역이 직접 가진 것(Outline())에 그린다. 새 SHAPE_POLY_SET 을 넘기면 파이썬이 먼저 지워 프로그램이 죽는다.
            o = z.Outline()
            o.NewOutline()
            src = piece.Outline(i)
            for k in range(src.PointCount()):
                p = src.CPoint(k)
                o.Append(p.x, p.y)
            z.SetIsRuleArea(True)
            z.SetDoNotAllowTracks(True)
            z.SetDoNotAllowVias(True)
            z.SetDoNotAllowCopperPour(False)
            z.SetDoNotAllowPads(False)
            z.SetDoNotAllowFootprints(False)
            z.SetLayerSet(cu)
            board.Add(z)
            n += 1
    return n


def run_router(jar, dsn, ses, passes):
    if os.path.exists(ses):
        os.remove(ses)
    # Freerouting 1.9 는 일괄 실행에도 화면 크기를 묻는다 → 가상 화면(xvfb)에서 돌린다
    cmd = ['java', '-jar', jar, '-de', dsn, '-do', ses, '-mp', str(passes), '-mt', '1']
    if shutil.which('xvfb-run'):
        cmd = ['xvfb-run', '-a'] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1500)
    return (r.stdout + r.stderr)[-3000:]


# 주문 전에 사람이 보면 되는 알려진 항목 (배선·제조를 막지 않는다)
KNOWN = {
    'silk_overlap': '실크 글자 겹침', 'silk_over_copper': '실크가 패드 위', 'lib_footprint_issues': '라이브러리 원본과 다름(부품 자리 내장)',
    'starved_thermal': '방열 연결 살 부족', 'item_on_disabled_layer': '안 쓰는 층의 표시', 'hole_clearance': '부품 자체 구멍 간격(옆면 스위치 고정 핀)',
    'courtyards_overlap': '안테나 권장 금지 구역 안의 부품(작은 기판이라 줄여 잡음)',
}


def finish(board_path, base):
    """GND 면을 깔고 DRC 를 돌려 { unconnected, open, drc } 를 돌려준다. board_path 를 덮어쓴다."""
    board = pcbnew.LoadBoard(board_path)
    zones = add_gnd_pours(board)
    board.Save(board_path)
    board = pcbnew.LoadBoard(board_path)
    rpt = base + '-drc.txt'
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, False)
    text = open(rpt, encoding='utf-8', errors='replace').read()
    kinds = {}
    for m in re.finditer(r'^\[(\w+)\]', text, re.M):
        kinds[m.group(1)] = kinds.get(m.group(1), 0) + 1
    # 남은 미연결: 어느 넷의 어느 부품 핀 사이인지 (화면에 "손으로 이을 곳" 으로 보여 준다)
    opened = []
    for m in re.finditer(r'^\[unconnected_items\][^\n]*\n[^\n]*\n\s*@\(([-\d.]+) mm, ([-\d.]+) mm\): ([^\n]*)\n\s*@\(([-\d.]+) mm, ([-\d.]+) mm\): ([^\n]*)', text, re.M):
        net = re.search(r'\[([^\]]+)\]', m.group(3) + ' ' + m.group(6))
        if m.group(3) == m.group(6) or any(o['a'] == m.group(3).strip()[:80] and o['b'] == m.group(6).strip()[:80] for o in opened):
            continue
        opened.append({'net': net.group(1) if net else '', 'a': m.group(3).strip()[:80], 'b': m.group(6).strip()[:80], 'at': [float(m.group(1)), float(m.group(2))], 'to': [float(m.group(4)), float(m.group(5))]})
    m = re.search(r'Found (\d+) unconnected pads', text)
    un = int(m.group(1)) if m else len(opened)
    track_mm = round(sum(pcbnew.ToMM(t.GetLength()) for t in board.GetTracks() if t.GetClass() == 'PCB_TRACK'), 1)
    n_tracks = sum(1 for t in board.GetTracks() if t.GetClass() == 'PCB_TRACK')
    n_vias = sum(1 for t in board.GetTracks() if t.GetClass() == 'PCB_VIA')
    blocking = {k: v for k, v in kinds.items() if k not in KNOWN and k != 'unconnected_items'}
    known = [{'kind': k, 'count': v, 'why': KNOWN[k]} for k, v in kinds.items() if k in KNOWN]
    return {'zones': zones, 'unconnected': un, 'open': opened[:30], 'drc': kinds, 'blocking': blocking, 'known': known, 'track_mm': track_mm, 'tracks': n_tracks, 'vias': n_vias}


def main():
    path = sys.argv[1]
    jar = sys.argv[2] if len(sys.argv) > 2 else ''
    base = os.path.splitext(path)[0]
    board = pcbnew.LoadBoard(path)
    summary = {'board': os.path.basename(path), 'routed': False}
    # 기판 밖(오른쪽)에 늘어놓은 부품이 있으면 배선하지 않는다 (먼저 기판에 넣어야 한다)
    edge = board.GetBoardEdgesBoundingBox()
    outside = [f.GetReference() for f in board.GetFootprints() if not edge.Contains(f.GetPosition())]
    summary['outside'] = outside
    dsn, ses = base + '.dsn', base + '.ses'
    raw1 = base + '.pass1.kicad_pcb'  # 배선만 넣은 기판 (GND 면 전)
    if jar and not outside:
        add_edge_keepout(board)
        pcbnew.ExportSpecctraDSN(board, dsn)
        summary['router_log'] = run_router(jar, dsn, ses, 40)
        if os.path.exists(ses):
            import_ses(board, ses)
            summary['routed'] = True
    board.Save(raw1)
    shutil.copyfile(raw1, path)
    res = finish(path, base)
    summary['passes'] = 1
    # 미연결이 남으면 지금 배선을 그대로 두고 남은 넷만 한 번 더 배선해 본다. 더 나아졌을 때만 바꾼다.
    if summary['routed'] and res['unconnected']:
        try:
            b2 = pcbnew.LoadBoard(raw1)
            pcbnew.ExportSpecctraDSN(b2, dsn)
            log2 = run_router(jar, dsn, ses, 100)
            if os.path.exists(ses):
                for t in list(b2.GetTracks()):
                    b2.Remove(t)
                import_ses(b2, ses)
                raw2, out2 = base + '.pass2.kicad_pcb', base + '.pass2out.kicad_pcb'
                b2.Save(raw2)
                shutil.copyfile(raw2, out2)
                res2 = finish(out2, base + '.pass2')
                summary['pass2'] = {'unconnected': res2['unconnected'], 'blocking': res2['blocking']}
                if res2['unconnected'] < res['unconnected'] and sum(res2['blocking'].values()) <= sum(res['blocking'].values()):
                    shutil.copyfile(out2, path)
                    shutil.copyfile(base + '.pass2-drc.txt', base + '-drc.txt')
                    res = res2
                    summary['passes'] = 2
                    summary['router_log'] = log2
        except Exception as e:  # 2차 배선은 덤이다. 실패해도 1차 결과를 쓴다
            summary['pass2'] = {'error': str(e)[:200]}
    for f in (raw1, base + '.pass1.kicad_pro', base + '.pass2.kicad_pro', base + '.pass2out.kicad_pro', base + '.pass2.kicad_pcb', base + '.pass2out.kicad_pcb', base + '.pass2-drc.txt', base + '.pass2.kicad_prl', base + '.pass1.kicad_prl', base + '.pass2out.kicad_prl'):
        if os.path.exists(f):
            os.remove(f)
    summary.update(res)
    json.dump(summary, open(base + '-summary.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in summary.items() if k not in ('router_log', 'open')}, ensure_ascii=False))
    for o in res['open']:
        print('  미연결', o['net'], '|', o['a'], '↔', o['b'])


if __name__ == '__main__':
    main()
