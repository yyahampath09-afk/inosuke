// ============================================
// Cloudflare Worker — Inosuke Portfolio Backend
// ============================================

const FALLBACK_WEBHOOK = 'https://discord.com/api/webhooks/1550518225157099680/dJkBRH5qezeB1nCKvSKi11c7Uzl5CbzNP1AQWx9nC8UvnjyHq80WiCbLRUYtfzmkUJdr';

export default {
  async fetch(request, env, ctx) {
    env.DISCORD_WEBHOOK = env.DISCORD_WEBHOOK || FALLBACK_WEBHOOK;

    const url = new URL(request.url);

    // API: Log Visitor
    if (url.pathname === '/api/log-visitor' && request.method === 'POST') {
      return handleLogVisitor(request, env);
    }

    // API: Session Update
    if (url.pathname === '/api/session-update' && request.method === 'POST') {
      return handleSessionUpdate(request, env);
    }

    // Static Assets
    return env.ASSETS.fetch(request);
  }
};

// ============================================
// Visitor Logger
// ============================================
async function handleLogVisitor(request, env) {
  try {
    const data = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;

    if (!WEBHOOK_URL) {
      return jsonResponse({ error: 'Webhook not configured' }, 500);
    }

    const sessionId = data.sessionId || 'UNKNOWN';

    const embed = {
      title: '🌐 New Visitor — Inosuke.dev',
      description: `Someone just visited your portfolio! 🎉\n\n**📊 Session ID:** \`${sessionId}\``,
      color: 0x00D9FF,
      thumbnail: {
        url: data.country_code
          ? `https://flagcdn.com/w80/${data.country_code.toLowerCase()}.png`
          : 'https://files.catbox.moe/nbjy81.jpeg'
      },
      fields: [
        { name: '🌐 IP Address', value: `\`${data.ip || 'N/A'}\``, inline: true },
        { name: '📍 Location', value: `${data.city || 'N/A'}, ${data.country || 'N/A'}`, inline: true },
        { name: '🗺️ Region', value: data.region || 'N/A', inline: true },
        { name: '🏢 ISP', value: data.isp || 'N/A', inline: true },
        { name: '📡 Connection', value: data.connection || 'N/A', inline: true },
        { name: '🌍 Timezone', value: data.timezone || 'N/A', inline: true },
        { name: '📱 Device Type', value: data.deviceType || 'N/A', inline: true },
        { name: '💻 OS', value: data.os || 'N/A', inline: true },
        { name: '🏷️ Model', value: data.deviceModel || 'N/A', inline: true },
        { name: '🧭 Browser', value: data.browser || 'N/A', inline: true },
        { name: '🗣️ Languages', value: data.languages || 'N/A', inline: true },
        { name: '🍪 Cookies', value: data.cookies || 'N/A', inline: true },
        { name: '🖥️ Screen', value: data.screen || 'N/A', inline: true },
        { name: '🪟 Window', value: data.window || 'N/A', inline: true },
        { name: '🎨 Color Mode', value: data.colorMode || 'N/A', inline: true },
        { name: '🧠 CPU Cores', value: data.cpu || 'N/A', inline: true },
        { name: '💾 RAM', value: data.ram || 'N/A', inline: true },
        { name: '🎮 GPU', value: data.gpu || 'N/A', inline: true },
        { name: '👆 Touch', value: data.touch || 'N/A', inline: true },
        { name: '🔒 Do Not Track', value: data.dnt || 'N/A', inline: true },
        { name: '💰 Currency', value: data.currency || 'N/A', inline: true },
        { name: '🔋 Battery Level', value: data.batteryLevel || 'N/A', inline: true },
        { name: '⚡ Status', value: data.batteryStatus || 'N/A', inline: true },
        { name: '⏱️ Battery Time', value: data.batteryTime || 'N/A', inline: true },
        { name: '🌐 Online', value: data.online || 'N/A', inline: false }
      ],
      footer: {
        text: 'inosuke.dev · Visitor Tracker v2',
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
      throw new Error(`Discord responded with ${discordRes.status}`);
    }

    const discordData = await discordRes.json();
    const messageId = discordData.id;

    return jsonResponse({ ok: true, messageId: messageId });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ============================================
// Session Duration Update (with progress bar)
// ============================================
async function handleSessionUpdate(request, env) {
  try {
    const data = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;

    if (!WEBHOOK_URL) {
      return jsonResponse({ error: 'Webhook not configured' }, 500);
    }

    const sessionId = data.sessionId || 'UNKNOWN';
    const parentMessageId = data.messageId || null;
    const isFinal = data.isFinal || false;
    const durationMs = data.durationMs || 0;

    // ---- Progress bar (max 30 minutes) ----
    const MAX_MS = 30 * 60 * 1000;
    const barLength = 20;
    const ratio = Math.min(1, durationMs / MAX_MS);
    const filled = Math.floor(ratio * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    const percent = Math.round(ratio * 100);

    // ---- Milestone emoji based on duration ----
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

    const embedDescription =
      `**📊 Session ID:** \`${sessionId}\`\n` +
      `**⏱️ Active Time:** **${data.duration || '0s'}**\n\n` +
      `\`${bar}\` **${percent}%**\n\n` +
      `${milestone}\n\n` +
      statusText;

    const body = {
      username: 'Inosuke Visitor Bot',
      avatar_url: 'https://files.catbox.moe/nbjy81.jpeg',
      embeds: [{
        title: `${emoji} ${isFinal ? 'Final' : 'Live'} Session — ${data.duration || '0s'}`,
        description: embedDescription,
        color: color,
        fields: [
          {
            name: '🎯 Status',
            value: isFinal ? '🏁 Session Ended' : '📡 Currently Active',
            inline: true
          },
          {
            name: '📈 Progress',
            value: `${percent}% of 30m`,
            inline: true
          },
          {
            name: '🎖️ Milestone',
            value: milestone,
            inline: true
          }
        ],
        footer: {
          text: isFinal
            ? '🏁 Final report · visitor left'
            : '🔄 Live update · refreshes every 30s'
        },
        timestamp: new Date().toISOString()
      }]
    };

    // Reply to the original visitor message (only for live updates)
    if (parentMessageId && !isFinal) {
      body.message_reference = {
        message_id: parentMessageId,
        fail_if_not_exists: false
      };
    }

    await fetch(WEBHOOK_URL + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ============================================
// Helper
// ============================================
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
