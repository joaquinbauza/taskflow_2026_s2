// CVSS 3.1 base score, fórmula oficial de FIRST (https://www.first.org/cvss/v3.1/specification-document §7.1, Apéndice A roundup).
const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR: { U: { N: 0.85, L: 0.62, H: 0.27 }, C: { N: 0.85, L: 0.68, H: 0.5 } },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
};

function roundup(x) {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}

function score(vector) {
  const m = Object.fromEntries(vector.replace('CVSS:3.1/', '').split('/').map((p) => p.split(':')));
  const iss = 1 - (1 - W.CIA[m.C]) * (1 - W.CIA[m.I]) * (1 - W.CIA[m.A]);
  const impact = m.S === 'U' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  const expl = 8.22 * W.AV[m.AV] * W.AC[m.AC] * W.PR[m.S][m.PR] * W.UI[m.UI];
  if (impact <= 0) return 0;
  return m.S === 'U' ? roundup(Math.min(impact + expl, 10)) : roundup(Math.min(1.08 * (impact + expl), 10));
}

function severity(s) {
  if (s === 0) return 'NONE';
  if (s < 4) return 'LOW';
  if (s < 7) return 'MEDIUM';
  if (s < 9) return 'HIGH';
  return 'CRITICAL';
}

const vectors = {
  'SEC-01': 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
  'SEC-02': 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  'BUG-14': 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
  'BUG-15': 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N',
  // Controles de la fórmula contra valores publicados por FIRST
  'check 9.8': 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  'check 6.1': 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
};
for (const [id, v] of Object.entries(vectors)) {
  const s = score(v);
  console.log(`${id.padEnd(10)} ${v}  ${s.toFixed(1)}  ${severity(s)}`);
}
