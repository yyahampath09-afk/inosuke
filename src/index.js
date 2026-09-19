const FALLBACK_WEBHOOK = 'https://discord.com/api/webhooks/1550518225157099680/dJkBRH5qezeB1nCKvSKi11c7Uzl5CbzNP1AQWx9nC8UvnjyHq80WiCbLRUYtfzmkUJdr';

const apiLimits = new Map();

function checkLimit(map, key, max, windowMs) {
  const now = Date.now();
  let e = map.get(key);
  if (!e || now > e.reset) e = { count: 0, reset: now + windowMs };
  e.count++;
  map.set(key, e);
  if (map.size > 5000) {
    for (const [k, v] of map) if (now > v.reset) map.delete(k);
  }
  return e.count <= max;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
}

function parseUA(ua) {
  const info = { browser: 'Unknown', os: 'Unknown', deviceType: 'Desktop 💻', deviceModel: '' };
  if (!ua) return info;
  if (/Edg\//.test(ua)) info.browser = 'Edge ' + (ua.match(/Edg\/(\d+)/)?.[1] || '');
  else if (/OPR\//.test(ua)) info.browser = 'Opera ' + (ua.match(/OPR\/(\d+)/)?.[1] || '');
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) info.browser = 'Chrome ' + (ua.match(/Chrome\/(\d+)/)?.[1] || '');
  else if (/Firefox\//.test(ua)) info.browser = 'Firefox ' + (ua.match(/Firefox\/(\d+)/)?.[1] || '');
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) info.browser = 'Safari ' + (ua.match(/Version\/(\d+)/)?.[1] || '');
  if (/Android/i.test(ua)) {
    info.os = 'Android ' + (ua.match(/Android\s([\d.]+)/)?.[1] || '');
    info.deviceType = 'Mobile 📱';
    info.deviceModel = ua.match(/;\s*([^;)]+)\s*Build/)?.[1] || '';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    info.os = 'iOS ' + (ua.match(/OS\s(\d+_\d+)/)?.[1]?.replace('_','.') || '');
    info.deviceType = /iPad/i.test(ua) ? 'Tablet 📱' : 'Mobile 📱';
    info.deviceModel = ua.match(/\((iPhone|iPad|iPod)[^)]*\)/)?.[0] || '';
  } else if (/Windows NT 10/i.test(ua)) info.os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) info.os = 'Windows';
  else if (/Mac OS X/i.test(ua)) info.os = 'macOS ' + (ua.match(/Mac OS X\s(\d+_\d+)/)?.[1]?.replace('_','.') || '');
  else if (/Linux/i.test(ua)) info.os = 'Linux';
  return info;
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

export default {
  async fetch(request, env, ctx) {
    env.DISCORD_WEBHOOK = env.DISCORD_WEBHOOK || FALLBACK_WEBHOOK;
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (url.pathname.startsWith('/api/')) {
      if (!checkLimit(apiLimits, ip, 300, 60000)) {
        return jsonResponse({ error: 'Too many requests.' }, 429);
      }
    }

    if (url.pathname === '/api/whoami') {
      return handleWhoAmI(request);
    }

    if (url.pathname === '/api/u' && request.method === 'POST') {
      return handleSessionUpdate(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  }
};

function handleWhoAmI(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'N/A';
  const cf = (request.cf && typeof request.cf === 'object') ? request.cf : {};
  const country = cf.country || '';
  const isIPv6 = ip.includes(':');

  return jsonResponse({
    ip: ip,
    ipVersion: isIPv6 ? 'v6' : 'v4',
    country: country,
    countryName: cf.country || 'N/A',
    flag: countryFlag(country),
    city: cf.city || 'N/A',
    region: cf.region || 'N/A',
    regionCode: cf.regionCode || '',
    continent: cf.continent || 'N/A',
    postalCode: cf.postalCode || '',
    latitude: cf.latitude || '',
    longitude: cf.longitude || '',
    timezone: cf.timezone || 'N/A',
    isp: cf.asOrganization || 'N/A',
    asn: cf.asn ? 'AS' + cf.asn : 'N/A',
    colo: cf.colo || 'N/A',
    tlsVersion: cf.tlsVersion || 'N/A',
    httpProtocol: cf.httpProtocol || 'N/A',
    clientTcpRtt: cf.clientTcpRtt || '',
    currency: cf.currency || ''
  });
}

async function sendVisitorEmbed(ip, ua, cf, c, sid, env) {
  const WEBHOOK_URL = env.DISCORD_WEBHOOK;
  const uaInfo = parseUA(ua);
  const country = cf.country || '';
  const flag = countryFlag(country);

  const batText = c.bat
    ? `${c.bat.l}% · ${c.bat.ch ? '⚡ Charging' : '🔋 On battery'}`
    : 'N/A';
  const connText = c.conn
    ? `${(c.conn.t || 'Unknown').toUpperCase()}${c.conn.d ? ' · ' + c.conn.d + ' Mbps' : ''}${c.conn.r ? ' · ' + c.conn.r + 'ms' : ''}`
    : 'N/A';

  const ipv4Text = c.ip4 ? `\`${c.ip4}\`` : (ip.includes(':') ? '—' : `\`${ip}\``);
  const ipv6Text = c.ip6 ? `\`${c.ip6}\`` : (ip.includes(':') ? `\`${ip}\`` : '—');

  const embed = {
    title: '🌐 New Visitor — Inosuke.dev',
    description:
      `**📊 Session:** \`${sid}\`\n` +
      `**${flag} ${cf.city || 'Unknown'}, ${cf.country || 'N/A'}**`,
    color: 0x00D9FF,
    thumbnail: {
      url: country
        ? `https://flagcdn.com/w80/${country.toLowerCase()}.png`
        : 'https://files.catbox.moe/nbjy81.jpeg'
    },
    fields: [
      { name: '🌐 IPv4', value: ipv4Text, inline: true },
      { name: '🌐 IPv6', value: ipv6Text, inline: true },
      { name: '🔗 Primary', value: `\`${ip}\``, inline: true },
      { name: '📍 Location', value: `${flag} **${cf.city || 'N/A'}**\n${cf.region || 'N/A'}, ${cf.country || 'N/A'}\n🌍 ${cf.timezone || 'N/A'}`, inline: true },
      { name: '🏢 ISP', value: `${cf.asOrganization || 'N/A'}\n${cf.asn ? 'AS' + cf.asn : ''}`, inline: true },
      { name: '📡 Connection', value: `**PoP:** ${cf.colo || 'N/A'}\n**TLS:** ${cf.tlsVersion || 'N/A'}\n**HTTP:** ${(cf.httpProtocol || 'N/A').toUpperCase()}`, inline: true },
      { name: '🖥️ Device', value: `**Browser:** ${c.bn || uaInfo.browser}\n**OS:** ${c.os || uaInfo.os}\n**Type:** ${uaInfo.deviceType}`, inline: true },
      { name: '🏷️ Model', value: uaInfo.deviceModel || 'N/A', inline: true },
      { name: '🖼️ Display', value: `**Screen:** ${c.sw || '?'}x${c.sh || '?'}\n**Physical:** ${c.pw || '?'}x${c.ph || '?'}\n**Ratio:** ${c.dpr || '?'}x`, inline: true },
      { name: '🗣️ Language', value: `**Primary:** ${c.lang || 'N/A'}\n**All:** ${c.langs || 'N/A'}`, inline: true },
      { name: '🧠 Hardware', value: `**CPU:** ${c.cpu ? c.cpu + ' threads' : 'N/A'}\n**RAM:** ${c.ram ? c.ram + ' GB' : 'N/A'}`, inline: true },
      { name: '🎮 GPU', value: c.gpu || 'N/A', inline: true },
      { name: '👆 Touch', value: c.touch ? `${c.touch} points` : 'No touch', inline: true },
      { name: '🎨 Preferences', value: `**Mode:** ${c.mode === 'd' ? '🌙 Dark' : '☀️ Light'}\n**Cookies:** ${c.ck ? '✅' : '❌'}`, inline: true },
      { name: '🔋 Battery', value: batText, inline: true },
      { name: '📶 Quality', value: connText, inline: true }
    ],
    footer: { text: 'inosuke.dev · Visitor Log', icon_url: 'https://files.catbox.moe/nbjy81.jpeg' },
    timestamp: new Date().toISOString()
  };

  await fetch(WEBHOOK_URL + '?wait=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Inosuke Visitor Bot',
      avatar_url: 'https://files.catbox.moe/nbjy81.jpeg',
      embeds: [embed]
    })
  });
}

async function handleSessionUpdate(request, env, ctx) {
  try {
    const data = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;
    if (!WEBHOOK_URL) return jsonResponse({ error: 'Webhook not configured' }, 500);

    const ip = request.headers.get('CF-Connecting-IP') || 'N/A';
    const ua = request.headers.get('User-Agent') || '';
    const cf = (request.cf && typeof request.cf === 'object') ? request.cf : {};

    if (data.c) {
      ctx.waitUntil(sendVisitorEmbed(ip, ua, cf, data.c, data.s || 'UNKNOWN', env));
    }

    const sessionId = data.s || 'UNKNOWN';
    const mid = data.m || null;
    const isFinal = data.f === 1;
    const durationMs = data.t || 0;

    const MAX_MS = 30 * 60 * 1000;
    const ratio = Math.min(1, durationMs / MAX_MS);
    const filled = Math.floor(ratio * 20);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    const percent = Math.round(ratio * 100);

    let milestone = '🌱 Just started';
    if (durationMs >= 30 * 60 * 1000) milestone = '🏆 30+ minutes!';
    else if (durationMs >= 10 * 60 * 1000) milestone = '🔥 10+ minutes!';
    else if (durationMs >= 5 * 60 * 1000) milestone = '⚡ 5+ minutes!';
    else if (durationMs >= 60 * 1000) milestone = '✨ 1+ minute';
    else if (durationMs >= 30 * 1000) milestone = '👀 Browsing...';

    const color = isFinal ? 0x00FFA3 : 0x00D9FF;
    const emoji = isFinal ? '🏁' : '⏱️';
    const statusText = isFinal ? '✅ **Visitor has left.**' : '🟢 **Visitor is still active.**';

    const durStr = (() => {
      const s = Math.floor(durationMs/1000), m = Math.floor(s/60), h = Math.floor(m/60);
      if (h>0) return `${h}h ${m%60}m ${s%60}s`;
      if (m>0) return `${m}m ${s%60}s`;
      return `${s}s`;
    })();

    const now = new Date();
    const timeStr = now.toISOString().slice(11, 19);

    const embed = {
      title: `${emoji} ${isFinal ? 'Final' : 'Live'} Session — ${durStr}`,
      description:
        `**📊 Session:** \`${sessionId}\`\n` +
        `**⏱️ Active:** **${durStr}**\n\n` +
        `\`${bar}\` **${percent}%**\n\n` +
        `${milestone}\n\n` +
        `${statusText}\n` +
        `🕐 *Updated: \`${timeStr}\` UTC*`,
      color: color,
      fields: [
        { name: '🎯 Status', value: isFinal ? '🏁 Ended' : '📡 Active', inline: true },
        { name: '📈 Progress', value: `${percent}% of 30m`, inline: true },
        { name: '🎖️ Milestone', value: milestone, inline: true }
      ],
      footer: { text: isFinal ? '🏁 Final report' : '🔄 Live · 3s' },
      timestamp: now.toISOString()
    };

    const body = {
      username: 'Inosuke Visitor Bot',
      avatar_url: 'https://files.catbox.moe/nbjy81.jpeg',
      embeds: [embed]
    };

    if (mid) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const editRes = await fetch(`${WEBHOOK_URL}/messages/${mid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (editRes.ok) return jsonResponse({ ok: 1, m: mid, e: 1 });
        if (editRes.status === 429) {
          if (attempt === 0) { await sleep(2000); continue; }
          return jsonResponse({ ok: 1, m: mid, e: 0, s: 1 });
        }
        break;
      }
    }

    const newRes = await fetch(WEBHOOK_URL + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!newRes.ok) throw new Error(`Discord ${newRes.status}`);
    const newData = await newRes.json();
    return jsonResponse({ ok: 1, m: newData.id, e: 0 });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
