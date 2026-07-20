const $ = (selector, scope = document) => scope.querySelector(selector);

const overall = $('[data-overall]');
const summary = $('[data-summary]');
const panel = $('.status-overall');
const recheck = $('[data-recheck]');
const checked = $('[data-checked]');
const latency = $('[data-latency]');
const region = $('[data-region]');

const serviceLabels = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Unavailable',
  checking: 'Checking',
};

const renderService = (id, state) => {
  const service = $(`[data-service="${id}"]`);
  if (!service) return;
  service.dataset.state = state;
  $('strong span', service).textContent = serviceLabels[state] || state;
};

const runStatusCheck = async () => {
  panel.dataset.state = 'checking';
  overall.textContent = 'Checking systems…';
  summary.textContent = 'Contacting the live deployment.';
  recheck.disabled = true;
  recheck.textContent = 'Checking…';
  ['website', 'api', 'edge'].forEach((id) => renderService(id, 'checking'));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(`/api/status?view=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Status function returned ${response.status}`);
    const data = await response.json();
    const state = data.overall === 'operational' ? 'operational' : data.overall === 'degraded' ? 'degraded' : 'outage';

    panel.dataset.state = state;
    overall.textContent = state === 'operational' ? 'All systems operational' : state === 'degraded' ? 'Some systems are degraded' : 'Service interruption detected';
    summary.textContent = data.message || 'The live check completed.';
    renderService('website', data.services?.website?.status || 'outage');
    renderService('api', 'operational');
    renderService('edge', data.region ? 'operational' : 'degraded');
    checked.dateTime = data.checkedAt;
    checked.textContent = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(new Date(data.checkedAt));
    latency.textContent = Number.isFinite(data.services?.website?.latencyMs) ? `${data.services.website.latencyMs} ms` : 'No response';
    region.textContent = data.region || 'Unknown';
  } catch (error) {
    panel.dataset.state = 'outage';
    overall.textContent = 'Live check unavailable';
    summary.textContent = location.protocol === 'file:' ? 'Deploy to Vercel to run the server-side health check.' : 'The status function could not complete this request.';
    renderService('website', 'outage');
    renderService('api', 'outage');
    renderService('edge', 'degraded');
    checked.textContent = 'just now';
    latency.textContent = 'No response';
    region.textContent = 'Unknown';
  } finally {
    clearTimeout(timeout);
    recheck.disabled = false;
    recheck.textContent = 'Run check';
  }
};

recheck.addEventListener('click', runStatusCheck);
addEventListener('pageshow', runStatusCheck);
