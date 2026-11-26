// Prueba 3: ninguna noticia trae el artículo completo; todas traen enlace y fuente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collect, fixtureFetcher } from '../scripts/collect.mjs';
import { parseFeed } from '../scripts/parse.mjs';
import { NEWS_SOURCES, LIMITS } from '../scripts/sources.mjs';

const NOW = new Date('2026-11-26T08:00:00Z');
const ALLOWED = ['id', 'title', 'summary', 'url', 'source', 'sourceId', 'market', 'tags', 'lang', 'time'];

test('p1 todas las noticias: título, fuente, hora, enlace y como máximo una línea de resumen', async () => {
  const { news } = await collect({ fetchText: fixtureFetcher('tests/fixtures'), now: NOW });
  for (const it of news.items) {
    assert.deepEqual(Object.keys(it).filter((k) => !ALLOWED.includes(k)), [], 'campos extra (¿cuerpo del artículo?)');
    assert.match(it.url, /^https?:\/\//);
    assert.ok(it.source);
    assert.ok(it.summary.length <= LIMITS.summaryChars, `resumen de ${it.summary.length} caracteres`);
    assert.ok(!/[\r\n]/.test(it.summary), 'resumen de varias líneas');
    assert.ok(!/<[a-z][\s\S]*>/i.test(it.summary + it.title), 'HTML dentro');
  }
});

test('p1 aunque el feed traiga el artículo entero (content:encoded), solo sale una línea', () => {
  const body = 'Párrafo largo del artículo. '.repeat(200);
  const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>
<title>Titular de prueba</title><link>https://ejemplo.com/nota</link><pubDate>Thu, 26 Nov 2026 07:00:00 GMT</pubDate>
<description><![CDATA[<p>${body}</p>]]></description><content:encoded><![CDATA[<p>${body}</p><p>Segundo párrafo secreto.</p>]]></content:encoded></item></channel></rss>`;
  const [it] = parseFeed(xml, NEWS_SOURCES[0], NOW);
  assert.ok(it.summary.length <= LIMITS.summaryChars);
  assert.ok(!JSON.stringify(it).includes('Segundo párrafo secreto'));
});

test('p1 las copias reales que traen el cuerpo del artículo no se cuelan', () => {
  for (const s of NEWS_SOURCES) {
    const xml = readFileSync(`tests/fixtures/${s.id}.xml`, 'utf8');
    const items = parseFeed(xml, s, NOW);
    const longest = Math.max(...items.map((i) => JSON.stringify(i).length));
    assert.ok(longest < 1200, `${s.id}: una noticia ocupa ${longest} bytes`);
  }
});
