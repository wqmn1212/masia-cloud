// 앱 개발용 블루투스 코드 생성: 통신 설계(buildGatt)에서 iOS(Swift, CoreBluetooth)·Android(Kotlin, BluetoothGatt) 장치 클래스를 만든다.
// 앱 개발팀이 UUID·바이트 형식을 손으로 옮기다 틀리는 일을 없애는 출발점이다 (연결·찾기·읽기·쓰기·알림·시각 맞추기).
// 주의: 이 저장소에서는 Swift·Kotlin 컴파일러를 돌리지 못한다. 앱 프로젝트에 넣어 빌드하면서 다듬어야 한다.
import { buildGatt } from './ble.js';
import { FEATURE_KINDS, pinPlan, MCUS } from './features.js';

const cls = (name) => { const s = String(name || 'Aegis').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''); return /^[A-Za-z]/.test(s) ? s : `Aegis${s}`; };
const ident = (c) => `f${c.index}${c.kind.charAt(0).toUpperCase()}${c.kind.slice(1)}`;
const BYTES = { u8: 1, u16: 2, i16: 2, u32: 4 };
const can = (c, a) => c.access.includes(a);

function model(dev) {
  const mcu = MCUS[dev?.mcu] ? dev.mcu : 'esp32c3';
  const plan = pinPlan((dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]), mcu, dev?.rules);
  const g = buildGatt({ ...dev, features: plan.features });
  const chars = g.chars.map((c) => ({ ...c, id: ident(c), numeric: c.type !== 'bytes' && c.type !== 'string', scale: c.scale || 1 }));
  return { g, chars, name: cls(g.device_name), sys: Object.fromEntries((g.sys || []).map((s) => [s.key, s])) };
}

export function swiftSdk(dev) {
  const { g, chars, name, sys } = model(dev);
  const L = [];
  L.push(`// ${name}Device.swift — ${g.device_name} 블루투스 연결 (AEGIS 워크벤치에서 만듦). 값은 모두 리틀 엔디언.`, 'import CoreBluetooth', 'import Foundation', '',
    `public protocol ${name}DeviceDelegate: AnyObject {`, `    func ${name.charAt(0).toLowerCase() + name.slice(1)}DidConnect()`, `    func ${name.charAt(0).toLowerCase() + name.slice(1)}DidDisconnect(error: Error?)`,
    ...chars.filter((c) => can(c, 'notify') || can(c, 'read')).map((c) => `    /// ${c.name}${c.unit ? ` (${c.unit})` : ''}\n    func ${name.charAt(0).toLowerCase() + name.slice(1)}(${c.id} value: ${c.numeric ? 'Double' : 'Data'})`), '}', '',
    `public final class ${name}Device: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {`,
    `    public static let deviceName = "${g.device_name}"`, `    public static let service = CBUUID(string: "${g.service}")`, `    public static let info = CBUUID(string: "${g.info.uuid}")  // 펌웨어 버전 (글)`,
    ...Object.values(sys).map((s) => `    public static let sys${s.key.charAt(0).toUpperCase() + s.key.slice(1)} = CBUUID(string: "${s.uuid}")  // ${s.name}`),
    ...chars.map((c) => `    public static let ${c.id} = CBUUID(string: "${c.uuid}")  // ${c.name}: ${c.type}${c.scale !== 1 ? ` ×${c.scale}` : ''}${c.unit ? ` ${c.unit}` : ''} · ${c.access.join('/')}`), '',
    `    public weak var delegate: ${name}DeviceDelegate?`, '    private var central: CBCentralManager!', '    private var peripheral: CBPeripheral?', '    private var chars: [CBUUID: CBCharacteristic] = [:]', '',
    '    public override init() { super.init(); central = CBCentralManager(delegate: self, queue: .main) }', '',
    '    /// 찾기 시작 (전원이 켜지면 자동으로 다시 부른다)', `    public func scan() { if central.state == .poweredOn { central.scanForPeripherals(withServices: [${name}Device.service]) } }`,
    '    public func disconnect() { if let p = peripheral { central.cancelPeripheralConnection(p) } }', '',
    '    // MARK: 쓰기');
  for (const c of chars.filter((x) => can(x, 'write'))) {
    if (c.numeric) L.push(`    /// ${c.name}${c.unit ? ` (${c.unit})` : ''}${c.min != null ? `, ${c.min}~${c.max}` : ''}`, `    public func set${c.id.charAt(0).toUpperCase() + c.id.slice(1)}(_ value: Double) { write(${name}Device.${c.id}, int: Int((value / ${c.scale}).rounded()), bytes: ${BYTES[c.type]}) }`);
    else L.push(`    /// ${c.name} (바이트 그대로)`, `    public func send${c.id.charAt(0).toUpperCase() + c.id.slice(1)}(_ data: Data) { write(${name}Device.${c.id}, data: data) }`);
  }
  if (sys.time) L.push('    /// 장치 시계를 휴대폰 현지 시각으로 맞춘다 (연결 직후 한 번)', `    public func syncTime() { let local = Int(Date().timeIntervalSince1970) + TimeZone.current.secondsFromGMT(); write(${name}Device.sysTime, int: local, bytes: 4) }`);
  if (sys.schedule) L.push('    /// 수면 일정: 켜짐, 취침 시·분, 감광 분, 기상 시·분, 증광 분, 기상 밝기 %', `    public func setSchedule(on: Bool, bedHour: Int, bedMinute: Int, dimMinutes: Int, wakeHour: Int, wakeMinute: Int, riseMinutes: Int, wakeLevel: Int) { write(${name}Device.sysSchedule, data: Data([on ? 1 : 0, UInt8(bedHour), UInt8(bedMinute), UInt8(dimMinutes), UInt8(wakeHour), UInt8(wakeMinute), UInt8(riseMinutes), UInt8(wakeLevel)])) }`);
  L.push('', '    private func write(_ uuid: CBUUID, int: Int, bytes: Int) { var v = UInt32(truncatingIfNeeded: int).littleEndian; write(uuid, data: Data(bytes: &v, count: bytes)) }',
    '    private func write(_ uuid: CBUUID, data: Data) { if let c = chars[uuid] { peripheral?.writeValue(data, for: c, type: .withResponse) } }',
    '    private static func int(_ d: Data, signed: Bool) -> Int { var v: UInt32 = 0; for (i, b) in d.prefix(4).enumerated() { v |= UInt32(b) << (8 * UInt32(i)) }; if signed && d.count == 2 { return Int(Int16(truncatingIfNeeded: v)) }; return Int(v) }', '',
    '    // MARK: CoreBluetooth', '    public func centralManagerDidUpdateState(_ central: CBCentralManager) { scan() }',
    '    public func centralManager(_ central: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) { central.stopScan(); peripheral = p; p.delegate = self; central.connect(p) }',
    `    public func centralManager(_ central: CBCentralManager, didConnect p: CBPeripheral) { p.discoverServices([${name}Device.service]) }`,
    `    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) { chars = [:]; delegate?.${name.charAt(0).toLowerCase() + name.slice(1)}DidDisconnect(error: error) }`,
    '    public func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) { p.services?.forEach { p.discoverCharacteristics(nil, for: $0) } }',
    '    public func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {', '        for c in service.characteristics ?? [] { chars[c.uuid] = c; if c.properties.contains(.notify) { p.setNotifyValue(true, for: c) } }',
    ...(sys.time ? ['        syncTime()'] : []), `        delegate?.${name.charAt(0).toLowerCase() + name.slice(1)}DidConnect()`, '    }',
    '    public func peripheral(_ p: CBPeripheral, didUpdateValueFor c: CBCharacteristic, error: Error?) {', '        guard let d = c.value else { return }', '        switch c.uuid {',
    ...chars.filter((c) => can(c, 'notify') || can(c, 'read')).map((c) => `        case ${name}Device.${c.id}: delegate?.${name.charAt(0).toLowerCase() + name.slice(1)}(${c.id}: ${c.numeric ? `Double(${name}Device.int(d, signed: ${c.type === 'i16'}))${c.scale !== 1 ? ` * ${c.scale}` : ''}` : 'd'})`),
    '        default: break', '        }', '    }', '}', '');
  return L.join('\n');
}

export function kotlinSdk(dev, { pkg = 'biz.aegistrade.device' } = {}) {
  const { g, chars, name, sys } = model(dev);
  const L = [];
  L.push(`// ${name}Device.kt — ${g.device_name} 블루투스 연결 (AEGIS 워크벤치에서 만듦). 값은 모두 리틀 엔디언.`, '// 권한: BLUETOOTH_SCAN, BLUETOOTH_CONNECT (Android 12 이상) 을 먼저 받아야 한다.', `package ${pkg}`, '',
    'import android.annotation.SuppressLint', 'import android.bluetooth.*', 'import android.bluetooth.le.*', 'import android.content.Context', 'import android.os.ParcelUuid', 'import java.util.*', '',
    `interface ${name}Listener {`, '    fun onConnected() {}', '    fun onDisconnected() {}',
    ...chars.filter((c) => can(c, 'notify') || can(c, 'read')).map((c) => `    /** ${c.name}${c.unit ? ` (${c.unit})` : ''} */\n    fun on${c.id.charAt(0).toUpperCase() + c.id.slice(1)}(value: ${c.numeric ? 'Double' : 'ByteArray'}) {}`), '}', '',
    '@SuppressLint("MissingPermission")', `class ${name}Device(private val context: Context, private val listener: ${name}Listener) {`, '    companion object {',
    `        const val DEVICE_NAME = "${g.device_name}"`, `        val SERVICE: UUID = UUID.fromString("${g.service}")`, `        val INFO: UUID = UUID.fromString("${g.info.uuid}")  // 펌웨어 버전 (글)`,
    ...Object.values(sys).map((s) => `        val SYS_${s.key.toUpperCase()}: UUID = UUID.fromString("${s.uuid}")  // ${s.name}`),
    ...chars.map((c) => `        val ${c.id.replace(/([A-Z])/g, '_$1').toUpperCase()}: UUID = UUID.fromString("${c.uuid}")  // ${c.name}: ${c.type}${c.scale !== 1 ? ` ×${c.scale}` : ''}${c.unit ? ` ${c.unit}` : ''} · ${c.access.join('/')}`),
    '        private val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")', '    }', '',
    '    private var gatt: BluetoothGatt? = null', '    private val queue: ArrayDeque<() -> Unit> = ArrayDeque()  // GATT 는 한 번에 한 작업만 받는다', '    private var busy = false', '',
    '    fun scan() {', '        val scanner = (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter.bluetoothLeScanner',
    '        scanner.startScan(listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE)).build()), ScanSettings.Builder().build(), object : ScanCallback() {',
    '            override fun onScanResult(type: Int, result: ScanResult) { scanner.stopScan(this); gatt = result.device.connectGatt(context, false, callback) }', '        })', '    }',
    '    fun disconnect() { gatt?.disconnect(); gatt?.close(); gatt = null }', '');
  const up = (c) => c.id.replace(/([A-Z])/g, '_$1').toUpperCase();
  for (const c of chars.filter((x) => can(x, 'write'))) {
    if (c.numeric) L.push(`    /** ${c.name}${c.unit ? ` (${c.unit})` : ''}${c.min != null ? `, ${c.min}~${c.max}` : ''} */`, `    fun set${c.id.charAt(0).toUpperCase() + c.id.slice(1)}(value: Double) = write(${up(c)}, le(Math.round(value / ${c.scale}), ${BYTES[c.type]}))`);
    else L.push(`    /** ${c.name} (바이트 그대로) */`, `    fun send${c.id.charAt(0).toUpperCase() + c.id.slice(1)}(data: ByteArray) = write(${up(c)}, data)`);
  }
  if (sys.time) L.push('    /** 장치 시계를 휴대폰 현지 시각으로 맞춘다 (연결 직후 한 번) */', '    fun syncTime() { val now = System.currentTimeMillis(); write(SYS_TIME, le((now + TimeZone.getDefault().getOffset(now)) / 1000, 4)) }');
  if (sys.schedule) L.push('    /** 수면 일정: 켜짐, 취침 시·분, 감광 분, 기상 시·분, 증광 분, 기상 밝기 % */', '    fun setSchedule(on: Boolean, bedHour: Int, bedMinute: Int, dimMinutes: Int, wakeHour: Int, wakeMinute: Int, riseMinutes: Int, wakeLevel: Int) = write(SYS_SCHEDULE, byteArrayOf(if (on) 1 else 0, bedHour.toByte(), bedMinute.toByte(), dimMinutes.toByte(), wakeHour.toByte(), wakeMinute.toByte(), riseMinutes.toByte(), wakeLevel.toByte()))');
  L.push('', '    private fun le(v: Long, n: Int) = ByteArray(n) { i -> ((v shr (8 * i)) and 0xFF).toByte() }',
    '    private fun int(d: ByteArray, signed: Boolean): Long { var v = 0L; d.take(4).forEachIndexed { i, b -> v = v or ((b.toLong() and 0xFF) shl (8 * i)) }; return if (signed && d.size == 2) v.toShort().toLong() else v }',
    '    private fun ch(uuid: UUID) = gatt?.getService(SERVICE)?.getCharacteristic(uuid)',
    '    @Suppress("DEPRECATION")', '    private fun write(uuid: UUID, data: ByteArray) = enqueue { val c = ch(uuid); if (c == null) next() else { c.value = data; c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT; if (gatt?.writeCharacteristic(c) != true) next() } }',
    '    private fun enqueue(job: () -> Unit) { synchronized(queue) { queue.add(job) }; if (!busy) next() }', '    private fun next() { val job = synchronized(queue) { queue.pollFirst() }; busy = job != null; job?.invoke() }', '',
    '    private val callback = object : BluetoothGattCallback() {', '        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, state: Int) {', '            if (state == BluetoothProfile.STATE_CONNECTED) g.discoverServices()',
    '            else if (state == BluetoothProfile.STATE_DISCONNECTED) { synchronized(queue) { queue.clear() }; busy = false; listener.onDisconnected() }', '        }',
    '        @Suppress("DEPRECATION")', '        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {', '            g.getService(SERVICE)?.characteristics?.filter { it.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 }?.forEach { c ->',
    '                enqueue { g.setCharacteristicNotification(c, true); val d = c.getDescriptor(CCCD); if (d == null) next() else { d.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE; if (!g.writeDescriptor(d)) next() } }', '            }',
    ...(sys.time ? ['            syncTime()'] : []), '            enqueue { listener.onConnected(); next() }', '        }',
    '        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) = next()', '        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) = next()',
    '        @Suppress("DEPRECATION")', '        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {', '            val d = c.value ?: return', '            when (c.uuid) {',
    ...chars.filter((c) => can(c, 'notify') || can(c, 'read')).map((c) => `                ${up(c)} -> listener.on${c.id.charAt(0).toUpperCase() + c.id.slice(1)}(${c.numeric ? `int(d, ${c.type === 'i16'}).toDouble()${c.scale !== 1 ? ` * ${c.scale}` : ''}` : 'd'})`),
    '            }', '        }', '    }', '}', '');
  return L.join('\n');
}

export function sdkReadme(dev) {
  const { g, chars, name, sys } = model(dev);
  const w = chars.find((c) => can(c, 'write') && c.numeric), n = chars.find((c) => can(c, 'notify'));
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  return [`# ${g.device_name} 앱 연결 코드`, '', '워크벤치의 통신 설계에서 자동으로 만든 출발 코드입니다. UUID·바이트 형식은 펌웨어와 같습니다. 앱 프로젝트에 넣어 빌드하면서 다듬어 주세요 (자동 생성 코드는 앱 프로젝트에서 한 번도 빌드해 보지 않은 상태입니다).', '',
    '## 파일', '', `- \`ios/${name}Device.swift\` — CoreBluetooth. Info.plist 에 NSBluetoothAlwaysUsageDescription 필요`, `- \`android/${name}Device.kt\` — BluetoothGatt. BLUETOOTH_SCAN·BLUETOOTH_CONNECT 권한 필요`, '- `protocol.md` — 통신 문서 (항목·UUID·값 형식)', '',
    '## iOS', '', '```swift', `let device = ${name}Device()`, 'device.delegate = self', 'device.scan()', ...(w ? [`// 연결되면 (${lower}DidConnect)`, `device.set${w.id.charAt(0).toUpperCase() + w.id.slice(1)}(${w.max != null ? Math.round(w.max / 2) : 1})  // ${w.name}`] : []), ...(n ? [`// 알림: func ${lower}(${n.id} value: ${n.numeric ? 'Double' : 'Data'})  // ${n.name}`] : []), '```', '',
    '## Android', '', '```kotlin', `val device = ${name}Device(context, object : ${name}Listener {`, ...(n ? [`    override fun on${n.id.charAt(0).toUpperCase() + n.id.slice(1)}(value: ${n.numeric ? 'Double' : 'ByteArray'}) { /* ${n.name} */ }`] : []), '})', 'device.scan()', ...(w ? [`device.set${w.id.charAt(0).toUpperCase() + w.id.slice(1)}(${w.max != null ? Math.round(w.max / 2) : 1}.0)  // ${w.name}`] : []), '```', '',
    '## 알아 둘 것', '', `- 서비스 UUID \`${g.service}\` 로 찾습니다.`, ...(sys.time ? ['- 연결하면 장치 시계를 휴대폰 현지 시각으로 자동으로 맞춥니다 (syncTime).'] : []), '- 쓰기는 응답 있는 쓰기(with response)로 보내고, Android 는 한 번에 한 작업만 처리하도록 줄을 세웁니다.', '- 센서 보정·응답 시간·무선 업데이트 항목은 통신 문서에 있고, 이 코드에는 UUID 만 넣어 두었습니다.', ''].join('\n');
}

/** 묶음 파일 목록 [{ name, text }] */
export function sdkFiles(dev, protocolText = '') {
  const { name } = model(dev);
  return [{ name: 'README.md', text: sdkReadme(dev) }, { name: `ios/${name}Device.swift`, text: swiftSdk(dev) }, { name: `android/${name}Device.kt`, text: kotlinSdk(dev) }, ...(protocolText ? [{ name: 'protocol.md', text: protocolText }] : [])];
}
