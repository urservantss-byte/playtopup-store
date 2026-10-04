/* ===== QRIS dinamis: suntik nominal ke QRIS statis (format EMVCo) =====
 * Cara pakai: makeDynamicQris(QRIS_STATIS, 165000)
 * - Field 01 diubah 11 (statis) -> 12 (dinamis)
 * - Field 54 (nominal, Rupiah) disisipkan setelah field 53
 * - CRC16-CCITT (field 63) dihitung ulang
 */

function crc16ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseEMV(s) {
  const fields = [];
  let i = 0;
  while (i + 4 <= s.length) {
    const id = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    if (!/^\d{2}$/.test(id) || isNaN(len) || i + 4 + len > s.length) break;
    fields.push({ id, value: s.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return fields;
}

function serializeEMV(fields) {
  return fields.map(f => f.id + String(f.value.length).padStart(2, '0') + f.value).join('');
}

function looksLikeQris(s) {
  return typeof s === 'string' && s.startsWith('000201') && s.includes('ID.CO.QRIS.WWW');
}

// Validasi ketat: seluruh string harus ter-parse sempurna (round-trip)
function isValidPayload(s) {
  if (!looksLikeQris(s)) return false;
  try {
    const fields = parseEMV(s);
    if (!fields.length) return false;
    const hasCrc = fields[fields.length - 1].id === '63';
    const body = hasCrc ? fields.slice(0, -1) : fields;
    const rebuilt = serializeEMV(body) + (hasCrc ? '6304' + fields[fields.length - 1].value : '');
    if (rebuilt !== s) return false;
    if (hasCrc) return crc16ccitt(serializeEMV(body) + '6304') === fields[fields.length - 1].value;
    return true;
  } catch { return false; }
}

function merchantName(staticPayload) {
  try {
    const f = parseEMV(staticPayload.trim()).find(x => x.id === '59');
    return (f && f.value.trim()) || '';
  } catch { return ''; }
}

// Ubah QRIS statis -> dinamis dengan nominal (IDR, bilangan bulat)
function makeDynamicQris(staticPayload, amount) {
  const s = String(staticPayload || '').trim();
  if (!isValidPayload(s)) throw new Error('String QRIS tidak valid');
  const amt = String(Math.round(Number(amount)));
  if (!/^[1-9]\d*$/.test(amt)) throw new Error('Nominal tidak valid');
  if (amt.length > 12) throw new Error('Nominal terlalu besar');

  let fields = parseEMV(s).filter(f => f.id !== '63' && f.id !== '54');
  const f01 = fields.find(f => f.id === '01');
  if (f01) f01.value = '12'; // dinamis

  const amtField = { id: '54', value: amt };
  const idx53 = fields.findIndex(f => f.id === '53');
  if (idx53 >= 0) fields.splice(idx53 + 1, 0, amtField);
  else {
    // cari posisi numerik yg benar (54 < 55..63)
    let pos = fields.findIndex(f => f.id > '54');
    if (pos < 0) pos = fields.length;
    fields.splice(pos, 0, amtField);
  }

  let out = serializeEMV(fields) + '6304';
  out += crc16ccitt(out);
  return out;
}

module.exports = { makeDynamicQris, merchantName, looksLikeQris, isValidPayload, crc16ccitt };
