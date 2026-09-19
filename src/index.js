async function handleLogVisitor(request, env) {
  try {
    const client = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;
    if (!WEBHOOK_URL) return jsonResponse({ error: 'Webhook not configured' }, 500);

    // ---- Server-side enrichment ----
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

    // ✅ FIX: Combined fields to stay under Discord's 25-field limit
    const embed = {
      title: '🌐 New Visitor — Inosuke.dev',
      description:
        `Someone just visited your portfolio! 🎉\n\n` +
        `**📊 Session ID:** \`${client.sessionId || 'UNKNOWN'}\`\n` +
        `**${flag} ${cf.city || 'Unknown'}, ${cf.country || 'N/A'}**`,
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
        text: 'inosuke.dev · Visitor Tracker v4',
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
    return jsonResponse({ ok: true, messageId: discordData.id });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
