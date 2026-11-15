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


def add_edge_keepout(board, margin=0.6):
    """기판 테두리 안쪽 margin mm 띠에 배선·비아 금지 구역을 둔다 (자동 배선이 테두리에 붙지 않게).
    구역은 기판 파일에 남겨 둔다 (KiCad 에서 손으로 고칠 때도 같은 규칙이 걸린다. 동박 면은 막지 않는다)."""
    outline = pcbnew.SHAPE_POLY_SET()
    if not board.GetBoardPolygonOutlines(outline):
        return None
    inner = pcbnew.SHAPE_POLY_SET(outline)
    inner.Inflate(MM(-margin), 16)
    bb = board.GetBoardEdgesBoundingBox()
    bb.Inflate(MM(2))
    z = pcbnew.ZONE(board)
    # 외곽선은 구역이 직접 가진 것(Outline())에 그린다. 새 SHAPE_POLY_SET 을 넘기면 파이썬이 먼저 지워 프로그램이 죽는다.
    ring = z.Outline()
    ring.NewOutline()
    for x, y in ((bb.GetLeft(), bb.GetTop()), (bb.GetRight(), bb.GetTop()), (bb.GetRight(), bb.GetBottom()), (bb.GetLeft(), bb.GetBottom())):
        ring.Append(x, y)
    ring.BooleanSubtract(inner, pcbnew.SHAPE_POLY_SET.PM_FAST)
    z.SetIsRuleArea(True)
    z.SetDoNotAllowTracks(True)
    z.SetDoNotAllowVias(True)
    z.SetDoNotAllowCopperPour(False)
    z.SetDoNotAllowPads(False)
    z.SetDoNotAllowFootprints(False)
    z.SetLayerSet(pcbnew.LSET.AllCuMask())
    board.Add(z)
    return z


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
    if jar and not outside:
        dsn, ses = base + '.dsn', base + '.ses'
        add_edge_keepout(board)
        pcbnew.ExportSpecctraDSN(board, dsn)
        # Freerouting 1.9 는 일괄 실행에도 화면 크기를 묻는다 → 가상 화면(xvfb)에서 돌린다
        cmd = ['java', '-jar', jar, '-de', dsn, '-do', ses, '-mp', '40', '-mt', '1']
        if shutil.which('xvfb-run'):
            cmd = ['xvfb-run', '-a'] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1500)
        summary['router_log'] = (r.stdout + r.stderr)[-3000:]
        if os.path.exists(ses):
            summary['tracks'], summary['vias'] = import_ses(board, ses)
            summary['routed'] = True
    summary['zones'] = add_gnd_pours(board)
    board.Save(path)
    board = pcbnew.LoadBoard(path)
    rpt = base + '-drc.txt'
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, False)
    text = open(rpt, encoding='utf-8', errors='replace').read()
    kinds = {}
    for m in re.finditer(r'^\[(\w+)\]', text, re.M):
        kinds[m.group(1)] = kinds.get(m.group(1), 0) + 1
    m = re.search(r'Found (\d+) unconnected pads', text)
    summary['unconnected'] = int(m.group(1)) if m else None
    summary['drc'] = kinds
    summary['track_mm'] = round(sum(pcbnew.ToMM(t.GetLength()) for t in board.GetTracks() if t.GetClass() == 'PCB_TRACK'), 1)
    json.dump(summary, open(base + '-summary.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in summary.items() if k != 'router_log'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
