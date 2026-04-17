const { toText } = require('./payment-gateway-config');

const fetchFn = global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function parseResponseData(response) {
    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (_error) {
        return { message: text };
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchFn(url, {
            ...options,
            signal: controller.signal
        });
        const data = await parseResponseData(response);
        return { response, data };
    } finally {
        clearTimeout(timeout);
    }
}

function resolveBaseUrl(config = {}) {
    return String(config.baseUrl || '').replace(/\/+$/, '');
}

function withApiToken(url, config = {}) {
    const endpoint = new URL(url);
    const apiToken = toText(config.apiToken);
    if (apiToken) {
        endpoint.searchParams.set('api_token', apiToken);
    }
    return endpoint.toString();
}

function buildHeaders() {
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json'
    };
}

function resolveHostAndProtocol(req) {
    const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'localhost:3000').trim();
    const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').trim().toLowerCase();
    const protocol = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'https';
    return { host, protocol };
}

function resolvePostbackUrl(req, config = {}) {
    if (toText(config.postbackUrl)) return toText(config.postbackUrl);
    const { host, protocol } = resolveHostAndProtocol(req);
    const token = toText(config.webhookToken);
    const params = new URLSearchParams();
    params.set('gateway', 'atomopay');
    if (token) params.set('token', token);
    return `${protocol}://${host}/api/pix/webhook?${params.toString()}`;
}

async function requestCreateTransaction(config = {}, payload = {}) {
    const endpoint = withApiToken(`${resolveBaseUrl(config)}/transactions`, config);
    const timeoutMs = Number(config.timeoutMs || 12000);
    const headers = buildHeaders();

    let last = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload || {})
        }, timeoutMs);
        last = result;
        if (result.response?.ok) return result;

        const status = Number(result.response?.status || 0);
        const retryable = status === 408 || status === 429 || status >= 500 || !status;
        if (!retryable || attempt === 2) return result;
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    }

    return last || { response: { ok: false, status: 500 }, data: { error: 'request_failed' } };
}

async function requestTransactionById(config = {}, transactionHash = '') {
    const hash = String(transactionHash || '').trim();
    if (!hash) {
        return { response: { ok: false, status: 400 }, data: { error: 'missing_transaction_hash' } };
    }

    const endpoint = withApiToken(`${resolveBaseUrl(config)}/transactions/${encodeURIComponent(hash)}`, config);
    const timeoutMs = Number(config.timeoutMs || 12000);
    const headers = buildHeaders();

    let last = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await fetchWithTimeout(endpoint, {
            method: 'GET',
            headers
        }, timeoutMs);
        last = result;
        if (result.response?.ok || Number(result.response?.status || 0) === 404) return result;

        const status = Number(result.response?.status || 0);
        const retryable = status === 408 || status === 429 || status >= 500 || !status;
        if (!retryable || attempt === 2) return result;
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    }

    return last || { response: { ok: false, status: 500 }, data: { error: 'status_failed' } };
}

module.exports = {
    requestCreateTransaction,
    requestTransactionById,
    resolvePostbackUrl
};
