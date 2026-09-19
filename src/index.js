// ============================================
// Cloudflare Worker — Inosuke Portfolio Backend v6
// Fixed: Discord 25-field limit + robust session edit
// ============================================

const FALLBACK_WEBHOOK = 'https://discord.com/api/webhooks/1550518225157099680/dJkBRH5qezeB1nCKvSKi11c7Uzl5CbzNP1AQWx9nC8UvnjyHq80WiCbLRUYtfzmkUJdr';

// ---------- Rate Limit Store ----------
const rateLimitStore = new Map();
function checkRateLimit(ip, maxPerMinute = 60) {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + 60000 };
  entry.count++;
  rateLimitStore.set(ip, entry);
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) if (now > v.resetAt) rateLimitStore.delete(k);
  }
  return entry.count <= maxPerMinute;
}

// ---------- Helpers ----------
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

function parseUserAgent(ua) {
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

function formatBatteryTime(seconds) {
  if (!seconds || seconds === Infinity || seconds === 0) return 'Calculating...';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}

// ============================================
// Main Worker
// ============================================
export default {
  async fetch(request, env, ctx) {
    env.DISCORD_WEBHOOK = env.DISCORD_WEBHOOK || FALLBACK_WEBHOOK;
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!checkRateLimit(ip, 60)) {
        return jsonResponse({ error: 'Too many requests.' }, 429);
      }
    }

    if (url.pathname === '/api/log-visitor' && request.method === 'POST') {
      return handleLogVisitor(request, env);
    }

    if (url.pathname === '/api/session-update' && request.method === 'POST') {
      return handleSessionUpdate(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

// ============================================
// MESSAGE 1: Visitor Logger (STATIC — never edited)
// ============================================
async function handleLogVisitor(request, env) {
  try {
    const client = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;
    if (!WEBHOOK_URL) return jsonResponse({ error: 'Webhook not configured' }, 500);

    const ip = request.headers.get('CF-Connecting-IP') || 'N/A';
    const ua = request.headers.get('User-Agent') || '';
    const cf = (request.cf && typeof request.cf === 'object') ? request.cf : {};

    const uaInfo = parseUserAgent(ua);
    const country = cf.country || '';
    const flag = countryFlag(country);

    const batLevel = client.battery?.level;
    const batCharging = client.battery?.charging;
    const batTime = batCharging === true
      ? formatBatteryTime(client.battery?.chargingTime) + ' to full'
      : batCharging === false
        ? formatBatteryTime(client.battery?.dischargingTime) + ' left'
        : 'N/A';

    let connText = 'Unknown';
    if (client.connection) {
      const c = client.connection;
      connText = `${(c.type || 'Unknown').toUpperCase()}`;
      if (c.downlink) connText += ` · ${c.downlink} Mbps`;
      if (c.rtt) connText += ` · ${c.rtt}ms`;
      if (c.saveData) connText += ` · 💾 Save-Data`;
    }

    const embed = {
      title: '🌐 New Visitor — Inosuke.dev',
      description:
        `Someone just visited your portfolio! 🎉\n\n` +
        `**📊 Session ID:** \`${client.sessionId || 'UNKNOWN'}\`\n` +
        `**${flag} ${cf.city || 'Unknown'}, ${cf.country || 'N/A'}**\n\n` +
        `⏱️ *Session time will appear in a **separate message** below.*`,
      color: 0x00D9FF,
      thumbnail: {
        url: country
          ? `https://flagcdn.com/w80/${country.toLowerCase()}.png`
          : 'https://files.catbox.moe/nbjy81.jpeg'
      },
      fields: [
        {
          name: '🌐 Network',
          value: `**IP:** \`${ip}\`\n**ISP:** ${cf.asOrganization || 'N/A'}\n**ASN:** ${cf.asn ? 'AS' + cf.asn : 'N/A'}`,
          inline: true
        },
        {
          name: '📍 Location',
          value: `${flag} **${cf.city || 'N/A'}**\n${cf.region || 'N/A'}, ${cf.country || 'N/A'}\n🌍 ${cf.timezone || 'N/A'}`,
          inline: true
        },
        {
          name: '📡 Connection',
          value: `**PoP:** ${cf.colo || 'N/A'}\n**TLS:** ${cf.tlsVersion || 'N/A'}\n**HTTP:** ${(cf.httpProtocol || 'N/A').toUpperCase()}`,
          inline: true
        },
        {
          name: '🖥️ Device',
          value: `**Browser:** ${uaInfo.browser}\n**OS:** ${uaInfo.os}\n**Type:** ${uaInfo.deviceType}`,
          inline: true
        },
        {
          name: '🏷️ Model',
          value: uaInfo.deviceModel || 'N/A',
          inline: true
        },
        {
          name: '🖼️ Display',
          value: `**Screen:** ${client.screen || 'N/A'}\n**Viewport:** ${client.viewport || 'N/A'}\n**Ratio:** ${client.pixelRatio ? client.pixelRatio + 'x' : 'N/A'}`,
          inline: true
        },
        {
          name: '🗣️ Language',
          value: `**Primary:** ${client.language || 'N/A'}\n**All:** ${client.languages || 'N/A'}`,
          inline: true
        },
        {
          name: '🧠 Hardware',
          value: `**CPU:** ${client.cores ? client.cores + ' cores' : 'N/A'}\n**RAM:** ${client.memory ? client.memory + ' GB' : 'N/A'}`,
          inline: true
        },
        {
          name: '🎮 GPU',
          value: client.gpu || 'N/A',
          inline: true
        },
        {
          name: '👆 Touch',
          value: client.touch ? `${client.touch} points` : 'No touch',
          inline: true
        },
        {
          name: '🎨 Preferences',
          value: `**Mode:** ${client.colorScheme === 'dark' ? '🌙 Dark' : '☀️ Light'}\n**Cookies:** ${client.cookies ? '✅' : '❌'}\n**DNT:** ${client.dnt ? '⚠️ On' : '✅ Off'}`,
          inline: true
        },
        {
          name: '🔋 Battery',
          value: batLevel !== undefined
            ? `${batLevel}% · ${batCharging ? '⚡ Charging' : '🔋 On battery'}\n${batTime}`
            : 'N/A',
          inline: true
        },
        {
          name: '📶 Quality',
          value: connText,
          inline: true
        },
        {
          name: '🕐 Client Time',
          value: client.timestamp ? new Date(client.timestamp).toISOString() : 'N/A',
          inline: false
        }
      ],
      footer: {
        text: 'inosuke.dev · Visitor Log v6',
        icon_url: 'https://files.catbox.moe/nbjy81.jpeg'
      },
      timestamp: new Date().toISOString()
    };

    const discordRes = await fetch(WEBHOOK_URL + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Inosuke Visitor Bot',
        avatar_url: 'https://files.catbox.moe/nbjy81.jpeg',
        embeds: [embed]
      })
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      throw new Error(`Discord ${discordRes.status}: ${errText.slice(0, 200)}`);
    }

    const discordData = await discordRes.json();
    return jsonResponse({ ok: true, visitorMessageId: discordData.id });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ============================================
// MESSAGE 2: Live Session (own message — EDITED every 6s)
// ============================================
async function handleSessionUpdate(request, env) {
  try {
    const data = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;
    if (!WEBHOOK_URL) return jsonResponse({ error: 'Webhook not configured' }, 500);

    const sessionId = data.sessionId || 'UNKNOWN';
    const sessionMessageId = data.sessionMessageId || null;
    const isFinal = data.isFinal || false;
    const durationMs = data.durationMs || 0;

    const MAX_MS = 30 * 60 * 1000;
    const barLength = 20;
    const ratio = Math.min(1, durationMs / MAX_MS);
    const filled = Math.floor(ratio * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    const percent = Math.round(ratio * 100);

    let milestone = '🌱 Just started';
    if (durationMs >= 30 * 60 * 1000) milestone = '🏆 30+ minutes!';
    else if (durationMs >= 10 * 60 * 1000) milestone = '🔥 10+ minutes!';
    else if (durationMs >= 5 * 60 * 1000) milestone = '⚡ 5+ minutes!';
    else if (durationMs >= 60 * 1000) milestone = '✨ 1+ minute';
    else if (durationMs >= 30 * 1000) milestone = '👀 Browsing...';

    const color = isFinal ? 0x00FFA3 : 0x00D9FF;
    const emoji = isFinal ? '🏁' : '⏱️';
    const statusText = isFinal
      ? '✅ **Visitor has left the site.**'
      : '🟢 **Visitor is still active on the site.**';

    const now = new Date();
    const timeStr = now.toISOString().slice(11, 19);

    const embed = {
      title: `${emoji} ${isFinal ? 'Final' : 'Live'} Session — ${data.duration || '0s'}`,
      description:
        `**📊 Session ID:** \`${sessionId}\`\n` +
        `**⏱️ Active Time:** **${data.duration || '0s'}**\n\n` +
        `\`${bar}\` **${percent}%**\n\n` +
        `${milestone}\n\n` +
        `${statusText}\n` +
        `🕐 *Last update: \`${timeStr}\` UTC*`,
      color: color,
      fields: [
        { name: '🎯 Status', value: isFinal ? '🏁 Session Ended' : '📡 Currently Active', inline: true },
        { name: '📈 Progress', value: `${percent}% of 30m`, inline: true },
        { name: '🎖️ Milestone', value: milestone, inline: true }
      ],
      footer: {
        text: isFinal ? '🏁 Final report · visitor left' : '🔄 Live · edits every 6s'
      },
      timestamp: now.toISOString()
    };

    const body = {
      username: 'Inosuke Visitor Bot',
      avatar_url: 'https://files.catbox.moe/nbjy81.jpeg',
      embeds: [embed]
    };

    // 🎯 Try EDIT first
    if (sessionMessageId) {
      const editRes = await fetch(`${WEBHOOK_URL}/messages/${sessionMessageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (editRes.ok) {
        return jsonResponse({ ok: true, edited: true, sessionMessageId });
      }

      if (editRes.status === 429) {
        return jsonResponse({ ok: false, error: 'Rate limited' }, 429);
      }
    }

    // Create NEW session message
    const newRes = await fetch(WEBHOOK_URL + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!newRes.ok) {
      const errText = await newRes.text();
      throw new Error(`Discord ${newRes.status}: ${errText.slice(0, 200)}`);
    }

    const newData = await newRes.json();
    return jsonResponse({ ok: true, edited: false, sessionMessageId: newData.id });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
