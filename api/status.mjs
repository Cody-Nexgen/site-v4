export const maxDuration = 5;

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const target = process.env.STATUS_CHECK_URL || `${requestUrl.origin}/`;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    let websiteStatus = 'outage';
    let statusCode = null;
    let error = null;

    try {
      const response = await fetch(target, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'FocuzNow-Status/1.0',
        },
        signal: controller.signal,
      });
      statusCode = response.status;
      websiteStatus = response.ok ? 'operational' : response.status < 500 ? 'degraded' : 'outage';
      await response.body?.cancel();
    } catch (cause) {
      error = cause?.name === 'AbortError' ? 'Health check timed out' : 'Health check failed';
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startedAt;
    const overall = websiteStatus === 'operational' ? 'operational' : websiteStatus === 'degraded' ? 'degraded' : 'outage';
    const payload = {
      overall,
      checkedAt: new Date().toISOString(),
      message: overall === 'operational' ? 'The public site responded normally to a fresh server-side request.' : error || `The public site responded with HTTP ${statusCode}.`,
      region: process.env.VERCEL_REGION || 'local',
      services: {
        website: { status: websiteStatus, latencyMs, statusCode },
        api: { status: 'operational' },
        edge: { status: process.env.VERCEL_REGION ? 'operational' : 'degraded' },
      },
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'CDN-Cache-Control': 'no-store',
      },
    });
  },
};
