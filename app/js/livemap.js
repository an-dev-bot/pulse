// Mapa en vivo: un lienzo con un nodo por historia, agrupado alrededor de sus activos.
// Tamaño = impacto. Tocar un nodo abre la historia. Sin bibliotecas.
// Con «reducir movimiento» se dibuja una sola vez, quieto. En equipos flojos no se monta (mapSupported).

const R = { high: 15, medium: 10, low: 6 };
const COLOR = { high: '#ff3b5c', medium: '#ffb020', low: '#5b8cff' };

export function mapSupported() {
  try {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    if (cores < 4 || mem < 2) return false;
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

// Sprite de brillo por color: se pinta una vez y luego solo se copia (barato a 60 fps).
function glowSprite(color, r) {
  const s = Math.ceil(r * 4);
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s, s, 0, s, s, s);
  grad.addColorStop(0, color + 'cc');
  grad.addColorStop(0.25, color + '55');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, s * 2, s * 2);
  return { c, s };
}

export function layout(items, w, h, label = (a) => a, other = 'Other') {
  const groups = new Map();
  for (const it of items) {
    const a = it.assets?.[0] || '';
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(it);
  }
  const keys = [...groups.keys()].sort((x, y) => groups.get(y).length - groups.get(x).length).slice(0, 8);
  const rest = [...groups.keys()].filter((k) => !keys.includes(k));
  if (rest.length) {
    const merged = rest.flatMap((k) => groups.get(k));
    if (keys.includes('')) groups.get('').push(...merged);
    else {
      keys.push('');
      groups.set('', merged);
    }
  }
  const hubs = keys.map((k, i) => {
    const ang = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const rx = w * 0.32;
    const ry = h * 0.32;
    return { key: k, name: k ? label(k) : other, x: w / 2 + Math.cos(ang) * rx * (keys.length > 1 ? 1 : 0), y: h / 2 + Math.sin(ang) * ry * (keys.length > 1 ? 1 : 0) };
  });
  const nodes = [];
  for (const hub of hubs) {
    const list = groups.get(hub.key) || [];
    list.forEach((it, j) => {
      const ang = j * 2.399963; // ángulo áureo
      const dist = 22 + 9 * Math.sqrt(j + 1);
      nodes.push({ id: it.id, level: it.level || 'low', title: it.title, hub, x: hub.x + Math.cos(ang) * dist, y: hub.y + Math.sin(ang) * dist, ph: j * 0.7, r: R[it.level] || R.low });
    });
  }
  return { hubs, nodes };
}

export function createLiveMap(canvas, items, { label, other, onOpen } = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sprites = Object.fromEntries(Object.entries(COLOR).map(([k, c]) => [k, glowSprite(c, R[k])]));
  let w = 0;
  let h = 0;
  let model = { hubs: [], nodes: [] };
  let raf = 0;
  let running = false;
  let hover = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth || 320;
    h = canvas.clientHeight || 320;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    model = layout(items, w, h, label, other);
    if (!running) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    for (const n of model.nodes) {
      ctx.moveTo(n.hub.x, n.hub.y);
      ctx.lineTo(n.dx ?? n.x, n.dy ?? n.y);
    }
    ctx.stroke();
    const k = reduce ? 0 : t / 1000;
    for (const n of model.nodes) {
      n.dx = n.x + Math.sin(k * 0.9 + n.ph) * 2.2;
      n.dy = n.y + Math.cos(k * 0.7 + n.ph) * 2.2;
      const sp = sprites[n.level];
      ctx.drawImage(sp.c, n.dx - sp.s, n.dy - sp.s);
      ctx.fillStyle = COLOR[n.level];
      ctx.beginPath();
      ctx.arc(n.dx, n.dy, n.r * (n === hover ? 0.75 : 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const hub of model.hubs) {
      ctx.fillStyle = 'rgba(10,12,16,0.8)';
      const tw = ctx.measureText(hub.name).width + 12;
      ctx.fillRect(hub.x - tw / 2, hub.y - 10, tw, 20);
      ctx.fillStyle = '#e8ecf3';
      ctx.fillText(hub.name, hub.x, hub.y + 4);
    }
    if (hover) {
      const txt = hover.title.length > 60 ? hover.title.slice(0, 57) + '…' : hover.title;
      ctx.font = '12px system-ui, sans-serif';
      const tw = Math.min(w - 16, ctx.measureText(txt).width + 16);
      const x = Math.max(8, Math.min(w - tw - 8, hover.dx - tw / 2));
      const y = hover.dy > 40 ? hover.dy - 34 : hover.dy + 18;
      ctx.fillStyle = 'rgba(20,24,32,0.95)';
      ctx.fillRect(x, y, tw, 22);
      ctx.fillStyle = '#e8ecf3';
      ctx.textAlign = 'left';
      ctx.fillText(txt, x + 8, y + 15, tw - 16);
    }
  }

  function loop(t) {
    if (!running) return;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function hit(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    let best = null;
    let bd = Infinity;
    for (const n of model.nodes) {
      const d = Math.hypot((n.dx ?? n.x) - x, (n.dy ?? n.y) - y);
      if (d < Math.max(n.r, 22) && d < bd) {
        best = n;
        bd = d;
      }
    }
    return best;
  }
  const onClick = (ev) => {
    const n = hit(ev);
    if (n) onOpen?.(n.id);
  };
  const onMove = (ev) => {
    const n = hit(ev);
    if (n !== hover) {
      hover = n;
      canvas.style.cursor = n ? 'pointer' : 'default';
      if (!running) draw(0);
    }
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('pointermove', onMove);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const api = {
    resume() {
      if (reduce || running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    destroy() {
      api.pause();
      ro.disconnect();
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('pointermove', onMove);
    },
    get nodes() {
      return model.nodes;
    },
    reduced: reduce,
  };
  api.resume();
  return api;
}
