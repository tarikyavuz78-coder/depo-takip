'use strict';
// Bağımlılıksız, basit XLSX yazıcı / okuyucu (ZIP + OOXML)
const zlib = require('zlib');

// ---------- ZIP ----------
function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

function zip(files) {
  // files: [{name, data(Buffer|string)}]
  const locals = [];
  const centrals = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(raw);
    const crc = zlib.crc32(raw) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 adlar
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Geçerli bir Excel (.xlsx) dosyası değil');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------- XML yardımcıları ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const unesc = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&amp;/g, '&');

function colName(i) {
  let s = '';
  i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
function colIndex(ref) {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ---------- YAZICI ----------
// sheets: [{ name, title?, subtitle?, columns:[{header,width,type:'text'|'num'|'int'}], rows:[[...]] }]
// Stil indeksleri: 0 normal, 1 başlık, 2 ondalık sayı, 3 tam sayı, 4 rapor başlığı, 5 alt başlık, 6 kırmızı vurgulu sayı
function writeXlsx(sheets) {
  const files = [];
  files.push({ name: '[Content_Types].xml', data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '</Types>' });
  files.push({ name: '_rels/.rels', data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>' });
  files.push({ name: 'xl/workbook.xml', data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((s, i) => `<sheet name="${esc(String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>' });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>' });
  files.push({ name: 'xl/styles.xml', data:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.###"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>' +
    '<fonts count="5">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E5F"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD0D7DE"/></left><right style="thin"><color rgb="FFD0D7DE"/></right><top style="thin"><color rgb="FFD0D7DE"/></top><bottom style="thin"><color rgb="FFD0D7DE"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="7">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>' });

  sheets.forEach((s, si) => {
    const cols = s.columns;
    let r = 0;
    const rowsXml = [];
    const cellStr = (ref, v, st) => `<c r="${ref}" t="inlineStr" s="${st}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    const cellNum = (ref, v, st) => `<c r="${ref}" s="${st}"><v>${v}</v></c>`;
    if (s.title) {
      r++; rowsXml.push(`<row r="${r}" ht="22" customHeight="1">${cellStr('A' + r, s.title, 4)}</row>`);
      if (s.subtitle) { r++; rowsXml.push(`<row r="${r}">${cellStr('A' + r, s.subtitle, 5)}</row>`); }
      r++; rowsXml.push(`<row r="${r}"/>`);
    }
    r++;
    const headerRow = r;
    rowsXml.push(`<row r="${r}" ht="30" customHeight="1">` + cols.map((c, ci) => cellStr(colName(ci) + r, c.header, 1)).join('') + '</row>');
    for (const row of s.rows) {
      r++;
      const cells = [];
      cols.forEach((c, ci) => {
        let v = row[ci];
        const ref = colName(ci) + r;
        if (v === null || v === undefined || v === '') { cells.push(`<c r="${ref}" s="0"/>`); return; }
        const isFlag = v && typeof v === 'object' && 'v' in v;
        const st = isFlag && v.alert ? 6 : (c.type === 'int' ? 3 : 2);
        if (isFlag) v = v.v;
        if ((c.type === 'num' || c.type === 'int') && typeof v === 'number' && isFinite(v)) cells.push(cellNum(ref, +v.toFixed(6), st));
        else cells.push(cellStr(ref, v, 0));
      });
      rowsXml.push(`<row r="${r}">${cells.join('')}</row>`);
    }
    const lastCol = colName(cols.length - 1);
    const xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      '<cols>' + cols.map((c, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${c.width || 14}" customWidth="1"/>`).join('') + '</cols>' +
      '<sheetData>' + rowsXml.join('') + '</sheetData>' +
      (s.rows.length ? `<autoFilter ref="A${headerRow}:${lastCol}${r}"/>` : '') +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';
    files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: xml });
  });
  return zip(files);
}

// ---------- OKUYUCU ----------
// İlk sayfayı satır dizisi olarak döndürür: [[hücre, ...], ...]
function readXlsx(buf) {
  const files = unzip(buf);
  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = files['xl/sharedStrings.xml'].toString('utf8');
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(xml))) {
      const parts = [];
      const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
      let t;
      while ((t = tRe.exec(m[1]))) parts.push(unesc(t[1]));
      shared.push(parts.join(''));
    }
  }
  // İlk sayfanın yolunu bul
  let sheetPath = null;
  try {
    const wb = files['xl/workbook.xml'].toString('utf8');
    const first = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb);
    const rels = files['xl/_rels/workbook.xml.rels'].toString('utf8');
    if (first) {
      const relRe = new RegExp(`<Relationship\\b[^>]*Id="${first[1]}"[^>]*>`);
      const rel = relRe.exec(rels);
      const target = rel && /Target="([^"]+)"/.exec(rel[0]);
      if (target) sheetPath = target[1].startsWith('/') ? target[1].slice(1) : 'xl/' + target[1].replace(/^\.\//, '');
    }
  } catch (e) { /* yoksay */ }
  if (!sheetPath || !files[sheetPath]) sheetPath = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!sheetPath) throw new Error('Excel dosyasında sayfa bulunamadı');
  const xml = files[sheetPath].toString('utf8');
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rAttr = /\br="(\d+)"/.exec(rm[1]);
    const rowIdx = rAttr ? parseInt(rAttr[1], 10) - 1 : rows.length;
    const row = [];
    const body = rm[2] || '';
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    let auto = 0;
    while ((cm = cRe.exec(body))) {
      const attrs = cm[1];
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs);
      const ci = ref ? colIndex(ref[1]) : auto;
      auto = ci + 1;
      const type = (/\bt="([^"]+)"/.exec(attrs) || [])[1] || 'n';
      const inner = cm[2] || '';
      let val = null;
      if (type === 'inlineStr') {
        const parts = [];
        const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
        let t;
        while ((t = tRe.exec(inner))) parts.push(unesc(t[1]));
        val = parts.join('');
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        if (v) {
          if (type === 's') val = shared[parseInt(v[1], 10)] ?? '';
          else if (type === 'str' || type === 'e') val = unesc(v[1]);
          else if (type === 'b') val = v[1] === '1';
          else val = parseFloat(v[1]);
        }
      }
      row[ci] = val;
    }
    rows[rowIdx] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

module.exports = { writeXlsx, readXlsx, zip, unzip };
