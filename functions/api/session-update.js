// Cloudflare Pages Function
// POST /api/session-update
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const WEBHOOK_URL = env.DISCORD_WEBHOOK;

    if (!WEBHOOK_URL) {
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Inosuke Visitor Bot',
        avatar_url: 'https://files.catbox.moe/nbjy81.jpeg',
        embeds: [
          {
            title: '⏱️ Session Duration Update',
            description: `A visitor has been on **Inosuke.dev** for **${data.duration}**`,
            color: 0x00FFA3,
            footer: { text: `Session ID: ${data.sessionId}` },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
