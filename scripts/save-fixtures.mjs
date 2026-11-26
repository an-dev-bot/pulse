// Guarda copias reales de cada fuente en tests/fixtures para que las pruebas corran sin internet.
// Uso: npm run p1:fixtures            (descarga de nuevo todas las copias)
//      node scripts/save-fixtures.mjs --solo-recortar   (solo recorta las copias que ya existen)
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SOURCES, P2_FETCHES } from './sources.mjs';
import { defaultFetchText } from './collect.mjs';
import { stripHtml } from './parse.mjs';
import { COINGECKO_MARKETS_URL, GT_BASE, DS_BASE } from '../app/js/config.js';

// Las copias van al repo público: el texto de cada nota se recorta a un extracto corto
// para no guardar nunca artículos completos.
export function trimFeed(xml) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return xml
    .replace(/<content:encoded>[\s\S]*?<\/content:encoded>/gi, '')
    .replace(/<(description|summary|content)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (m, tag, attrs = '', body) => {
      const text = stripHtml(body);
      return `<${tag}${attrs}>${esc(text.length > 300 ? text.slice(0, 300) + '…' : text)}</${tag}>`;
    });
}

const dir = 'tests/fixtures';

if (process.argv.includes('--solo-recortar')) {
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.xml'))) {
    await writeFile(join(dir, f), trimFeed(await readFile(join(dir, f), 'utf8')));
  }
  console.log('copias recortadas');
  process.exit(0);
}

// P2: universo de CNBC y cripto global. Se guardan solo los campos que se leen (copias chicas).
export function trimCnbc(text) {
  const j = JSON.parse(text);
  const list = j?.FormattedQuoteResult?.FormattedQuote || [];
  const keep = ['symbol', 'code', 'name', 'last', 'change', 'change_pct', 'last_time', 'realTime'];
  const out = list.map((q) => {
    const o = Object.fromEntries(keep.filter((k) => k in q).map((k) => [k, q[k]]));
    if (q.EventData?.next_earnings_date) o.EventData = { next_earnings_date: q.EventData.next_earnings_date };
    return o;
  });
  return JSON.stringify({ FormattedQuoteResult: { FormattedQuote: out } });
}
async function saveP2() {
  for (const s of P2_FETCHES) {
    try {
      const t = await defaultFetchText(s.url);
      await writeFile(join(dir, `${s.id}.json`), s.id.startsWith('cnbc-universe') ? trimCnbc(t) : t);
      console.log('guardado', s.id, t.length);
    } catch (e) {
      console.log('FALLA', s.id, e.message);
    }
  }
}
if (process.argv.includes('--solo-p2')) {
  await saveP2();
  process.exit(0);
}
await saveP2();

await mkdir(join(dir, 'direct'), { recursive: true });

for (const s of ALL_SOURCES) {
  try {
    const t = await defaultFetchText(s.url);
    const ext = s.type === 'rss' ? 'xml' : 'json';
    await writeFile(join(dir, `${s.id}.${ext}`), ext === 'xml' ? trimFeed(t) : t);
    console.log('guardado', s.id, t.length);
  } catch (e) {
    console.log('FALLA', s.id, e.message);
  }
}

const direct = {
  coingecko: COINGECKO_MARKETS_URL,
  'gt-new': `${GT_BASE}/networks/solana/new_pools?include=base_token`,
  'gt-volume': `${GT_BASE}/networks/solana/pools?sort=h24_volume_usd_desc&include=base_token`,
  'gt-trending': `${GT_BASE}/networks/solana/trending_pools?include=base_token`,
  'ds-boosts': `${DS_BASE}/token-boosts/top/v1`,
};
for (const [id, url] of Object.entries(direct)) {
  const t = await defaultFetchText(url);
  await writeFile(join(dir, 'direct', `${id}.json`), t);
  console.log('guardado', id, t.length);
}
// Datos de pares para los tokens promocionados de Solana
const boosts = JSON.parse(await defaultFetchText(direct['ds-boosts'])).filter((b) => b.chainId === 'solana').slice(0, 30);
const t = await defaultFetchText(`${DS_BASE}/tokens/v1/solana/${boosts.map((b) => b.tokenAddress).join(',')}`);
await writeFile(join(dir, 'direct', 'ds-tokens.json'), t);
console.log('guardado ds-tokens', t.length);
