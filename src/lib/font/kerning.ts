// opentype.js 1.x does not emit a `kern` table. We splice a Microsoft
// version-0, format-0 `kern` table into the generated sfnt so kerning is
// actually embedded in the OTF.

export type IndexedKern = { left: number; right: number; value: number };

const MAGIC = 0xb1b0afba;

function tableChecksum(view: DataView, start: number, length: number): number {
  let sum = 0;
  const padded = (length + 3) & ~3;
  for (let i = 0; i < padded; i += 4) {
    const b0 = start + i < view.byteLength ? view.getUint8(start + i) : 0;
    const b1 = start + i + 1 < view.byteLength ? view.getUint8(start + i + 1) : 0;
    const b2 = start + i + 2 < view.byteLength ? view.getUint8(start + i + 2) : 0;
    const b3 = start + i + 3 < view.byteLength ? view.getUint8(start + i + 3) : 0;
    sum = (sum + (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0)) >>> 0;
  }
  return sum >>> 0;
}

function buildKernData(pairs: IndexedKern[]): Uint8Array {
  const sorted = [...pairs].sort(
    (a, b) => a.left - b.left || a.right - b.right,
  );
  const n = sorted.length;
  const subtableLen = 14 + n * 6; // 8 (subtable hdr+fmt0 hdr part) + 6 + 6*n
  const total = 4 + subtableLen; // kern header (4) + subtable
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  let o = 0;
  v.setUint16(o, 0); o += 2; // version
  v.setUint16(o, 1); o += 2; // nTables
  // subtable
  v.setUint16(o, 0); o += 2; // subtable version
  v.setUint16(o, subtableLen); o += 2; // length
  v.setUint16(o, 0x0001); o += 2; // coverage: horizontal, format 0
  v.setUint16(o, n); o += 2; // nPairs
  let sr = 1;
  let es = 0;
  while (sr * 2 <= n) {
    sr *= 2;
    es++;
  }
  v.setUint16(o, sr * 6); o += 2; // searchRange
  v.setUint16(o, es); o += 2; // entrySelector
  v.setUint16(o, n * 6 - sr * 6); o += 2; // rangeShift
  for (const p of sorted) {
    v.setUint16(o, p.left); o += 2;
    v.setUint16(o, p.right); o += 2;
    v.setInt16(o, p.value); o += 2;
  }
  return new Uint8Array(buf);
}

type Entry = { tag: string; checksum: number; offset: number; length: number };

export function injectKernTable(
  input: ArrayBuffer,
  pairs: IndexedKern[],
): ArrayBuffer {
  if (pairs.length === 0) return input;
  const src = new DataView(input);
  const numTables = src.getUint16(4);
  const entries: Entry[] = [];
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    let tag = '';
    for (let j = 0; j < 4; j++) tag += String.fromCharCode(src.getUint8(base + j));
    entries.push({
      tag,
      checksum: src.getUint32(base + 4),
      offset: src.getUint32(base + 8),
      length: src.getUint32(base + 12),
    });
  }
  if (entries.some((e) => e.tag === 'kern')) return input;

  const kernData = buildKernData(pairs);
  const oldDirEnd = 12 + numTables * 16;
  const newNum = numTables + 1;
  const newDirEnd = 12 + newNum * 16;
  const shift = newDirEnd - oldDirEnd; // 16

  // total source data length (from end of original directory)
  const srcDataLen = input.byteLength - oldDirEnd;
  const kernOffset = (newDirEnd + srcDataLen + 3) & ~3;
  const totalLen = (kernOffset + kernData.length + 3) & ~3;

  const out = new ArrayBuffer(totalLen);
  const dv = new DataView(out);
  const ob = new Uint8Array(out);

  // header
  ob.set(new Uint8Array(input, 0, 4), 0); // sfnt version
  dv.setUint16(4, newNum);
  let sr = 1;
  let es = 0;
  while (sr * 2 <= newNum) {
    sr *= 2;
    es++;
  }
  dv.setUint16(6, sr * 16);
  dv.setUint16(8, es);
  dv.setUint16(10, newNum * 16 - sr * 16);

  // copy original table data region, shifted
  ob.set(new Uint8Array(input, oldDirEnd, srcDataLen), newDirEnd);
  // append kern data
  ob.set(kernData, kernOffset);

  const newEntries: Entry[] = entries.map((e) => ({
    ...e,
    offset: e.offset + shift,
  }));
  newEntries.push({
    tag: 'kern',
    checksum: tableChecksum(
      new DataView(out),
      kernOffset,
      kernData.length,
    ),
    offset: kernOffset,
    length: kernData.length,
  });
  newEntries.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  newEntries.forEach((e, i) => {
    const base = 12 + i * 16;
    for (let j = 0; j < 4; j++) ob[base + j] = e.tag.charCodeAt(j);
    dv.setUint32(base + 4, e.checksum >>> 0);
    dv.setUint32(base + 8, e.offset);
    dv.setUint32(base + 12, e.length);
  });

  // recompute head.checkSumAdjustment
  const head = newEntries.find((e) => e.tag === 'head');
  if (head) {
    dv.setUint32(head.offset + 8, 0);
    let fileSum = 0;
    for (let i = 0; i < totalLen; i += 4) {
      fileSum = (fileSum + (dv.getUint32(i) >>> 0)) >>> 0;
    }
    dv.setUint32(head.offset + 8, (MAGIC - fileSum) >>> 0);
  }

  return out;
}
