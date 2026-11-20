#!/usr/bin/env node
'use strict';
// 尺码计算工具：所有码数换算走这里，不要心算。
// 用法见每个子命令的 help，或 `node size.cjs`。

const LEN = { mm: 0.1, cm: 1, m: 100, in: 2.54, inch: 2.54, ft: 30.48 };
const MASS = { g: 0.001, kg: 1, jin: 0.5, '斤': 0.5, lb: 0.45359237, oz: 0.02834952 };

function fail(msg) { console.log('ERROR: ' + msg); process.exitCode = 1; }

function num(v) {
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

// ---------- 松量（加放量）区间，单位 cm，作用于胸围/腰围 ----------
const EASE = {
  tshirt:  { label: 'T恤/针织衫', range: [4, 10], knit: true },
  shirt:   { label: '衬衫（梭织）', range: [10, 16] },
  hoodie:  { label: '卫衣/帽衫', range: [8, 16], knit: true },
  jacket:  { label: '夹克/西装外套', range: [10, 16] },
  coat:    { label: '大衣/风衣', range: [16, 26] },
  down:    { label: '羽绒服（含叠穿）', range: [18, 30] },
  dressW:  { label: '连衣裙（梭织）', range: [6, 14] },
  dressK:  { label: '连衣裙（针织弹力）', range: [0, 6], knit: true },
  pants:   { label: '裤腰（有腰带/调节扣）', range: [0, 4], axis: 'waist' },
  pantsE:  { label: '裤腰（松紧/抽绳）', range: [-4, 2], axis: 'waist' },
  jeans:   { label: '牛仔/无弹力裤腰', range: [0, 3], axis: 'waist' }
};

// ---------- 面料常见水洗缩水率 % ----------
const SHRINK = {
  cotton: ['纯棉（未预缩）', 3, 5], cottonPre: ['纯棉（预缩/成衣水洗）', 1, 3],
  linen: ['亚麻/纯麻', 5, 8], wool: ['羊毛（可机洗标）', 8, 20],
  silk: ['真丝', 1, 3], poly: ['涤纶/锦纶', 0, 1],
  rayon: ['粘胶/人棉/天丝', 5, 8], denim: ['牛仔（含弹力）', 1, 3],
  blend: ['棉涤混纺', 2, 4]
};

// ---------- 鞋码：按脚长 cm 归档 ----------
// EU 由楦长公式 1.5×(脚长+1.5cm) 推得，CN 旧码 = 2×脚长−10，JP = 脚长 mm；三者长度锚定，可靠。
// US/UK 各品牌标法互差 ±1（Nike 女=男+1，通用表 +1.5），故只给基数与偏移说明。
const SHOE = [
  [21.0, 35, 3.5], [21.5, 35.5, 4], [22.0, 36, 4.5], [22.5, 36.5, 5],
  [23.0, 37.5, 5.5], [23.5, 38, 6], [24.0, 38.5, 6.5], [24.5, 39, 7],
  [25.0, 40, 7.5], [25.5, 41, 8], [26.0, 41.5, 8.5], [26.5, 42.5, 9],
  [27.0, 43, 9.5], [27.5, 44, 10], [28.0, 44.5, 10.5], [28.5, 45.5, 11],
  [29.0, 46, 11.5], [29.5, 47, 12], [30.0, 47.5, 12.5]
];

// ---------- 号型：GB/T 1335 型（净胸围 / 净腰围，A体） ----------
const CHEST = [72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116];
const LETTER = ['XXS', 'XS', 'S', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
const HEIGHT = [150, 155, 160, 165, 170, 175, 180, 185, 190, 195];
const WAIST = [60, 64, 68, 70, 72, 74, 78, 82, 86, 90, 94, 98, 102];
const PANTS_LETTER = ['XS', 'XS', 'S', 'S', 'M', 'M', 'L', 'L', 'XL', 'XL', '2XL', '3XL', '3XL'];

function nearest(arr, v) {
  let best = arr[0], bd = Math.abs(v - arr[0]);
  for (const a of arr) { const d = Math.abs(v - a); if (d < bd) { bd = d; best = a; } }
  return best;
}
function ceilAt(arr, v) {
  for (let i = 0; i < arr.length; i++) if (arr[i] >= v - 0.01) return i;
  return arr.length - 1;
}

function cmdUnit(a) {
  const v = num(a._[0]), from = (a._[1] || '').toLowerCase(), to = (a._[2] || a.to || '').toLowerCase();
  if (v == null || !from || !to) return fail('用法: unit <值> <原单位> <目标单位>，如 unit 175 cm in');
  const fam = k => (LEN[k] != null ? LEN : MASS[k] != null ? MASS : null);
  const F = fam(from), T = fam(to);
  if (!F || F !== T) return fail(`单位不同族或未知: ${from} / ${to}`);
  const r = v * F[from] / F[to];
  console.log(`${v} ${from} = ${+r.toFixed(2)} ${to}`);
}

function cmdBody(a) {
  const h = num(a._[0]), w = num(a._[1]);
  const sex = (a.sex || a._[2] || 'male').toLowerCase();
  if (h == null || w == null) return fail('用法: body <身高cm> <体重kg> [--sex male|female]');
  const bmi = w / Math.pow(h / 100, 2);
  const female = sex.startsWith('f');
  // 回归锚点：号型标准体（男 175/92A≈BMI21.5，女 165/88A≈BMI20.2）
  const baseC = female ? h * 0.5333 : h * 0.5257;
  const baseW = female ? h * 0.4242 : h * 0.4229;
  const kC = female ? 1.8 : 2.4, kW = female ? 3.0 : 4.4;
  const b0 = female ? 20.2 : 21.5;
  const chest = baseC + kC * (bmi - b0), waist = baseW + kW * (bmi - b0);
  const hip = (female ? h * 0.5576 : h * 0.52) + (female ? 2.2 : 3.4) * (bmi - b0);
  const eC = female ? 6 : 3, eW = female ? 4 : 5;
  console.log(`BMI ${bmi.toFixed(1)}（${bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '偏胖' : '肥胖'}）`);
  console.log(`净胸围 ≈ ${chest.toFixed(0)} cm（区间 ${(chest - eC).toFixed(0)}–${(chest + eC).toFixed(0)}）`);
  console.log(`净腰围 ≈ ${waist.toFixed(0)} cm（区间 ${(waist - eW).toFixed(0)}–${(waist + eW).toFixed(0)}）`);
  console.log(`净臀围 ≈ ${hip.toFixed(0)} cm（区间 ${(hip - (female ? 5 : 4)).toFixed(0)}–${(hip + (female ? 5 : 4)).toFixed(0)}）`);
  const ci = ceilAt(CHEST, chest);
  console.log(`对应号型 ${nearest(HEIGHT, h)}/${CHEST[ci]}A · ${LETTER[ci]}（下装 ${WAIST[ceilAt(WAIST, waist)]}cm · ${PANTS_LETTER[ceilAt(WAIST, waist)]}）`);
  console.log('注意: 身高体重推算为群体回归，个体误差可达 ±' + (female ? '6' : '3') + ' cm；' + (female ? '胸围受罩杯影响极大，' : '') + '有实测数据时一律以实测为准。');
}

function cmdTop(a) {
  let chest = num(a.chest), label = a.label;
  const height = num(a.height), waist = num(a.waist);
  const fit = (a.fit || 'regular');
  const type = a.type || 'shirt';
  if (label) {
    const i = LETTER.indexOf(String(label).toUpperCase());
    if (i < 0) return fail('可用码数标签: ' + LETTER.join('/'));
    chest = CHEST[i];
    console.log(`反向换算：${String(label).toUpperCase()} 名义净胸围 ${chest} cm（成衣胸围随版型 ±10 cm 浮动，标签不能跨品牌直接套用）`);
  }
  if (chest == null) return fail('用法: top --chest <净胸围cm> [--height 175] [--waist 80] [--fit slim|regular|relaxed] [--type shirt|tshirt|jacket|coat|down]');
  const ci = ceilAt(CHEST, chest);
  const easeRange = EASE[type] ? EASE[type].range : EASE.shirt.range;
  const mult = fit === 'slim' ? 0.6 : fit === 'relaxed' ? 1.5 : 1;
  const need = chest + easeRange[0] * mult;
  const needHi = chest + easeRange[1] * mult;
  console.log(`号型 ${nearest(HEIGHT, height || 170)}/${CHEST[ci]}A · 建议码 ${LETTER[ci]}`);
  if (waist != null) {
    const d = chest - waist;
    const female = (a.sex || '').startsWith('f');
    const bands = female ? [['Y', 19, 24], ['A', 14, 18], ['B', 9, 13], ['C', 4, 8]] : [['Y', 17, 24], ['A', 12, 16], ['B', 7, 11], ['C', 2, 6]];
    const band = bands.find(b => d >= b[1]) || bands[bands.length - 1];
    console.log(`胸腰差 ${d} cm → 体型 ${band[0]}（${female ? '女' : '男'}装 A/B/C 分档不同；B/C 体常需 +1 码或改腰围）`);
  }
  console.log(`成衣胸围需 ${need.toFixed(0)}–${needHi.toFixed(0)} cm（${EASE[type] ? EASE[type].label : '梭织上装'} 松量 ${easeRange[0]}–${easeRange[1]} cm ×${fit}）`);
  console.log(`对照欧码外套号 ${Math.round((need + needHi) / 8) * 2}`);
  if (waist != null) console.log(`下装参考净腰围 ${waist} cm，可用 pants 子命令细化`);
  console.log('提醒: 肩宽与衣长要单独核对，同码不同款这两项可差 4 cm 以上（优先级见 references/product-page.md）。');
}

function cmdShoe(a) {
  let foot = num(a.foot);
  const female = (a.sex || 'male').toLowerCase().startsWith('f');
  const cnOf = r => Math.round(r[0] * 2 - 10);
  const usOf = r => female ? r[2] + 1.5 : r[2];
  const ukOf = r => female ? r[2] + 0.5 : r[2] - 1;
  if (a.label) {
    const sys = (a.system || 'eu').toLowerCase();
    const target = num(a.label);
    let best = null, bd = 1e9;
    for (const r of SHOE) {
      const v = sys === 'cn' ? cnOf(r) : sys === 'jp' ? r[0] * 10 : sys === 'us' ? usOf(r) : sys === 'uk' ? ukOf(r) : r[1];
      const d = Math.abs(v - target);
      if (d < bd) { bd = d; best = r; }
    }
    if (bd > 1.2) return fail(`码数 ${a.label}(${sys}) 超出可映射范围，请直接用 --foot <脚长cm>`);
    foot = best[0];
    console.log(`反向换算：${a.label}(${sys}) ≈ 适合脚长 ${foot} cm`);
  }
  if (foot == null) return fail('用法: shoe --foot <脚长cm> [--sex male|female] | shoe --label 42 --system eu|cn|us|uk|jp');
  const row = SHOE.reduce((p, c) => Math.abs(c[0] - foot) < Math.abs(p[0] - foot) ? c : p);
  const idx = SHOE.indexOf(row), up = SHOE[idx + 1];
  console.log(`脚长 ${foot} cm → 归档档 ${row[0]} cm`);
  console.log(`EU ${row[1]} · CN 旧码 ${cnOf(row)} · JP ${Math.round(row[0] * 10)} mm（新码同 mm）`);
  console.log(`US ${female ? 'W' : 'M'} ${usOf(row)} · UK ${ukOf(row)}（美英码各品牌标法互差 ±1，只作参考）`);
  console.log(`对应鞋垫内长 ${(foot + 0.5).toFixed(1)}–${(foot + 1.5).toFixed(1)} cm（选码时先看商品页的内长，比看码数准）`);
  if (up && (foot > row[0] + 0.2 || /宽|高脚背|wide/.test(a.note || ''))) console.log(`脚长越档或脚宽/脚背高：上取 ${up[0]} cm 档 → EU ${up[1]} / CN ${cnOf(up)}`);
  console.log('注意: 皮鞋楦偏大、帆布与跑鞋偏小，同品牌内 楦型差异可达 1 码，品牌尺码表优先于本通用表。');
}

function cmdPants(a) {
  const waist = num(a.waist);
  if (waist == null) return fail('用法: pants --waist <净腰围cm> [--hip 92] [--type jeans|pants|pantsE]');
  const type = a.type || 'jeans';
  const range = EASE[type].range;
  const wi = ceilAt(WAIST, waist);
  console.log(`号型下装 ${WAIST[wi]} · 建议码 ${PANTS_LETTER[wi]}`);
  console.log(`市尺 ${(waist / 33.333).toFixed(2)} 尺 · 英寸腰围 W${Math.round(waist / 2.54)}`);
  console.log(`成衣腰围需 ${(waist + range[0]).toFixed(0)}–${(waist + range[1]).toFixed(0)} cm（${EASE[type].label}）`);
  if (num(a.hip)) {
    const hip = num(a.hip), ratio = hip / waist;
    console.log(`臀围 ${hip} cm → 成衣臀围需 ${(hip + 4).toFixed(0)}–${(hip + 8).toFixed(0)} cm；腰臀比 ${ratio.toFixed(2)}${ratio > 1.33 ? '，臀差大：腰到位则臀/大腿会紧，需选松量后移、后腰打省或可调腰的款' : ''}`);
  }
  console.log('注意: 欧美品牌有 vanity sizing，标称 W 可比实际大 2–5 cm，务必看成衣实测腰围。');
}

function cmdRing(a) {
  let d = num(a.diameter), c = num(a.circumference);
  if (!d && !c) return fail('用法: ring --diameter <内直径mm> | ring --circumference <内周长mm>');
  c = c || d * Math.PI;
  d = d || c / Math.PI;
  const us = (d - 11.63) / 0.8128;
  console.log(`内周长 ${c.toFixed(1)} mm · 内直径 ${d.toFixed(2)} mm`);
  console.log(`CN 号（周长-40 法则）≈ ${Math.max(1, Math.round(c - 40))} 号`);
  console.log(`US ≈ ${(Math.round(us * 2) / 2).toFixed(1)} · UK ≈ ${(Math.round(us * 2) / 2 - 1).toFixed(1)}`);
  console.log('注意: 港码另有独立刻度且各店表不一致，请以周长/直径 mm 为唯一准绳沟通。指节比根径粗时按指节选码。');
}

function verdict(ease, range, knit) {
  if (ease < range[0] - 2) return '偏紧：低于该品类最小松量，扣合/抬手会绷';
  if (ease < range[0]) return '贴身：略小于常规松量，仅在面料有弹力时可接受';
  if (ease <= range[1]) return '合适：落在常规松量区间' + (knit ? '（针织，体感比梭织宽松）' : '');
  if (ease <= range[1] + 8) return '宽松：oversize 观感，非版型偏差';
  return '过宽：明显大于常规，肩线/袖长大概率同时不匹配';
}

function cmdEase(a) {
  const g = num(a.garment), b = num(a.body), type = a.type || 'shirt';
  const E = EASE[type];
  if (g == null || b == null || !E) return fail('用法: ease --garment <成衣cm> --body <净体cm> --type ' + Object.keys(EASE).join('|') + '\n  成衣平铺读数（胸宽/腰宽）需 ×2 后再传入，松紧腰取自然平铺态');
  const ease = g - b;
  console.log(`成衣 ${g} cm − 净体 ${b} cm = 松量 ${ease} cm`);
  console.log(`${E.label} 常规区间 ${E.range[0]}–${E.range[1]} cm → ${verdict(ease, E.range, E.knit)}`);
  console.log('提醒: 成衣公差不小于 ±2 cm，松量差 1 cm 不构成版型偏大/偏小的结论。');
}

function cmdShrink(a) {
  const g = num(a.garment), b = num(a.body), type = a.type || 'shirt';
  let lo = num(a.rate), hi = lo;
  const f = (a.fabric || '').toLowerCase();
  if (lo == null && SHRINK[f]) { lo = SHRINK[f][1]; hi = SHRINK[f][2]; }
  if (g == null || b == null || lo == null) return fail('用法: shrink --garment <成衣cm> --body <净体cm> --fabric ' + Object.keys(SHRINK).join('|') + ' [--rate <%>] [--type shirt]');
  const E = EASE[type];
  const after = g * (1 - hi / 100), afterLo = g * (1 - lo / 100);
  console.log(`洗前松量 ${(g - b).toFixed(1)} cm → ${verdict(g - b, E.range, E.knit)}`);
  console.log(`洗后成衣 ≈ ${after.toFixed(1)}–${afterLo.toFixed(1)} cm（缩水 ${lo}–${hi}%，${SHRINK[f] ? SHRINK[f][0] : '自定义'}）`);
  console.log(`洗后松量 ${(after - b).toFixed(1)}–${(afterLo - b).toFixed(1)} cm → ${verdict(after - b, E.range, E.knit)}`);
  if (after - b < E.range[0] - 2) console.log('结论: 洗后有变紧风险，建议 +1 码或选预缩/成衣水洗工艺款。');
  else console.log('结论: 常规洗护尺寸风险可控。');
}

const CMDS = { unit: cmdUnit, body: cmdBody, top: cmdTop, shoe: cmdShoe, pants: cmdPants, ring: cmdRing, ease: cmdEase, shrink: cmdShrink };

const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd || cmd === 'help' || cmd === '--help') {
  console.log('尺码计算工具\n  unit   <值> <原单位> <目标单位>        长度/重量换算\n  body   <身高cm> <体重kg> [--sex]       由身高体重估算净体尺寸（低置信）\n  top    --chest <净胸围cm> [...]          上装号型/码数/成衣胸围需求\n  shoe   --foot <脚长cm> | --label --system   鞋码 CN/EU/US/UK/JP\n  pants  --waist <净腰围cm> [--hip]           下装码数/尺/英寸\n  ring   --diameter <mm> | --circumference    戒指号\n  ease   --garment <成衣cm> --body --type     松量判定\n  shrink --garment --body --fabric            洗后缩水判定\n品类 --type: ' + Object.keys(EASE).join('|') + '\n面料 --fabric: ' + Object.keys(SHRINK).join('|'));
  process.exitCode = cmd ? 1 : 0;
} else if (!CMDS[cmd]) fail(`未知子命令 ${cmd}，运行 node size.cjs 查看用法`);
else CMDS[cmd](parseArgs(argv.slice(1)));
