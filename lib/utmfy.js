const fetchFn = global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const { getSettings, defaultSettings } = require('./settings-store');

function normalizeEventName(value) {
    return String(value || '').trim().toLowerCase();
}

function isUtmifyOrdersEndpoint(endpoint) {
    return /api-credentials\/orders/i.test(endpoint || '');
}

function isUtmifyDomain(endpoint) {
    return /utmify\.com\.br/i.test(endpoint || '');
}

function pickText(value) {
    const text = String(value || '').trim();
    return text ? text : '';
}

function toNullable(value) {
    const text = String(value || '').trim();
    return text ? text : null;
}

function toIntCents(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
}

function normalizeAmount(value) {
    if (value === undefined || value === null || value === '') return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const normalized = raw.replace(',', '.');
    const num = Number(normalized);
    if (!Number.isFinite(num)) return 0;
    const hasDecimalMark = /[.,]/.test(raw);
    if (hasDecimalMark) return Number(num.toFixed(2));
    if (Number.isInteger(num) && Math.abs(num) >= 100) {
        return Number((num / 100).toFixed(2));
    }
    return Number(num.toFixed(2));
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toIsoUtc(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function splitName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { name: '' };
    return { name: parts.join(' ') };
}

function resolveOrderStatus(eventName, payload) {
    if (payload?.status) {
        const raw = String(payload.status).toLowerCase();
        if (['waiting_payment', 'paid', 'refused', 'refunded', 'chargedback'].includes(raw)) return raw;
    }
    if (eventName === 'pix_confirmed' || eventName === 'purchase' || eventName === 'upsell_pix_confirmed') return 'paid';
    if (eventName === 'pix_created' || eventName === 'checkout' || eventName === 'upsell_pix_created') return 'waiting_payment';
    if (eventName === 'pix_refunded') return 'refunded';
    if (eventName === 'pix_failed') return 'refused';
    return 'waiting_payment';
}

function resolveCommission(payload, totalPriceInCents) {
    if (payload?.commission && typeof payload.commission === 'object') {
        const commission = payload.commission || {};
        return {
            totalPriceInCents: Number(commission.totalPriceInCents ?? totalPriceInCents) || totalPriceInCents,
            gatewayFeeInCents: Number(commission.gatewayFeeInCents ?? 0) || 0,
            userCommissionInCents: Number(commission.userCommissionInCents ?? totalPriceInCents) || totalPriceInCents,
            currency: commission.currency || 'BRL'
        };
    }

    const feeFromPayload =
        Number(payload.gatewayFeeInCents) ||
        toIntCents(payload.gatewayFee || payload.taxa_deposito || 0) +
        toIntCents(payload.taxa_adquirente || 0);

    const userFromPayload =
        Number(payload.userCommissionInCents) ||
        toIntCents(payload.userCommission || payload.deposito_liquido || payload.valor_liquido || 0);

    let gatewayFeeInCents = Number.isFinite(feeFromPayload) ? feeFromPayload : 0;
    let userCommissionInCents = Number.isFinite(userFromPayload) ? userFromPayload : 0;

    if (!userCommissionInCents || userCommissionInCents <= 0) {
        userCommissionInCents = Math.max(0, totalPriceInCents - gatewayFeeInCents);
    }
    if (!gatewayFeeInCents || gatewayFeeInCents < 0) gatewayFeeInCents = 0;
    if (!userCommissionInCents || userCommissionInCents <= 0) userCommissionInCents = totalPriceInCents;

    return {
        totalPriceInCents,
        gatewayFeeInCents,
        userCommissionInCents,
        currency: payload.currency || 'BRL'
    };
}

function resolveRewardSnapshot(payload = {}) {
    const reward = asObject(payload.reward);
    const id = pickText(reward.id || payload.rewardId);
    const name = pickText(reward.name || reward.title || payload.rewardName);
    const price = normalizeAmount(
        reward.checkoutExtraPrice ??
        reward.extraPrice ??
        reward.price ??
        reward.successDisplayPrice ??
        payload.rewardExtraPrice ??
        0
    );
    if (!id && !name && price <= 0) return null;
    return {
        id: id || 'produto_ifood',
        name: name || 'Produto iFood',
        price
    };
}

function buildProductEntry({ id, name, price }) {
    return {
        id: pickText(id) || 'item_ifood',
        name: pickText(name) || 'Item iFood',
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: toIntCents(Math.max(0, Number(price || 0)))
    };
}

function buildUtmfyOrder(eventName, payload = {}, cfg = {}) {
    const personal = payload.personal || {};
    const address = payload.address || {};
    const shipping = payload.shipping || {};
    const bump = payload.bump || {};
    const utm = payload.utm || {};
    const tracking = payload.trackingParameters || {};

    const orderId =
        pickText(payload.txid) ||
        pickText(payload.orderId) ||
        pickText(payload.pixTxid) ||
        pickText(payload.sessionId) ||
        `order_${Date.now()}`;

    const status = resolveOrderStatus(eventName, payload);
    const createdAt = toIsoUtc(payload.createdAt || payload.pixCreatedAt || payload.data_registro || payload.data_transacao || Date.now());
    const approvedDate = status === 'paid' ? toIsoUtc(payload.approvedDate || payload.approvedAt || Date.now()) : null;
    const refundedAt = status === 'refunded' ? toIsoUtc(payload.refundedAt || payload.refunded_at || payload.data_estorno || Date.now()) : null;

    const shippingPrice = normalizeAmount(shipping.price || 0);
    const bumpPrice = normalizeAmount(bump.price || 0);
    const upsellEnabled = Boolean(payload?.upsell?.enabled);
    const upsellPrice = normalizeAmount(payload?.upsell?.price || 0);
    const upsellTitle = pickText(payload?.upsell?.title) || 'Prioridade de envio';
    const hasUpsellProduct = upsellEnabled && upsellPrice > 0;
    const reward = hasUpsellProduct ? null : resolveRewardSnapshot(payload);
    const rewardPrice = Number(reward?.price || 0);
    const totalAmount = normalizeAmount(
        payload.amount ||
        payload.pixAmount ||
        (hasUpsellProduct ? upsellPrice : (shippingPrice + rewardPrice + bumpPrice)) ||
        0
    );
    const totalPriceInCents = toIntCents(totalAmount);

    const customerName = splitName(personal.name || payload.client_name || payload.customer?.name || '').name;
    const customerEmail = pickText(personal.email || payload.client_email || payload.customer?.email);
    const customerPhone = pickText(personal.phoneDigits || personal.phone || payload.client_phone || payload.customer?.phone);
    const customerDoc = pickText(personal.cpf || payload.client_document || payload.customer?.cpf);
    const safeOrderId = String(orderId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-12) || 'lead';
    const safeEmail = customerEmail || `lead.${safeOrderId}@ifoodbag.app`;
    const safeName = customerName || 'Cliente iFood';

    const products = [];
    if (hasUpsellProduct) {
        products.push(buildProductEntry({
            id: payload?.upsell?.kind || 'upsell_frete_1dia',
            name: upsellTitle,
            price: upsellPrice
        }));
    }
    if (!hasUpsellProduct) {
        if (reward) {
            products.push(buildProductEntry({
                id: reward.id,
                name: reward.name,
                price: reward.price
            }));
        }
        if (shippingPrice > 0) {
            products.push(buildProductEntry({
                id: shipping.id || 'frete',
                name: shipping.name || 'Frete Bag iFood',
                price: shippingPrice
            }));
        }
    }
    if (!hasUpsellProduct && bumpPrice > 0) {
        products.push(buildProductEntry({
            id: 'seguro_bag',
            name: bump.title || 'Seguro Bag',
            price: bumpPrice
        }));
    }
    if (products.length === 0) {
        products.push(buildProductEntry({
            id: upsellEnabled ? (payload?.upsell?.kind || 'upsell_frete_1dia') : 'frete',
            name: upsellEnabled ? upsellTitle : 'Frete Bag iFood',
            price: totalAmount
        }));
    }

    return {
        orderId,
        platform: cfg.platform || 'IfoodBag',
        paymentMethod: 'pix',
        status,
        createdAt,
        approvedDate,
        refundedAt,
        customer: {
            name: safeName,
            email: safeEmail,
            phone: customerPhone || null,
            document: customerDoc || null,
            country: 'BR',
            ip: pickText(payload.client_ip || payload.ip || payload.metadata?.client_ip)
        },
        products,
        trackingParameters: {
            src: toNullable(tracking.src || utm.src),
            sck: toNullable(tracking.sck || utm.sck),
            utm_source: toNullable(tracking.utm_source || utm.utm_source),
            utm_campaign: toNullable(tracking.utm_campaign || utm.utm_campaign),
            utm_medium: toNullable(tracking.utm_medium || utm.utm_medium),
            utm_content: toNullable(tracking.utm_content || utm.utm_content),
            utm_term: toNullable(tracking.utm_term || utm.utm_term)
        },
        commission: resolveCommission(payload, totalPriceInCents),
        isTest: payload.isTest === true
    };
}

function buildRequestBody(endpoint, eventName, payload, cfg) {
    if (isUtmifyOrdersEndpoint(endpoint)) {
        return { body: buildUtmfyOrder(eventName, payload, cfg) };
    }
    return { body: { event: normalizeEventName(eventName) || 'event', payload } };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutRef = setTimeout(() => controller.abort(), Math.max(1200, Number(timeoutMs || 0) || 10000));
    try {
        return await fetchFn(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutRef);
    }
}

async function sendUtmfy(eventName, payload) {
    const settings = await getSettings().catch(() => defaultSettings);
    const cfg = settings.utmfy || {};

    if (!cfg.enabled || !cfg.endpoint) {
        return { ok: false, reason: 'disabled' };
    }

    const endpoint = String(cfg.endpoint || '').trim();
    const { body } = buildRequestBody(endpoint, eventName, payload || {}, cfg);

    const headers = {
        'Content-Type': 'application/json'
    };
    if (cfg.apiKey) {
        if (isUtmifyDomain(endpoint)) {
            headers['x-api-token'] = cfg.apiKey;
        } else {
            headers.Authorization = `Bearer ${cfg.apiKey}`;
        }
    }
    const timeoutMs = Number(cfg.timeoutMs || process.env.UTMFY_TIMEOUT_MS || 10000);

    const sendOnce = async () => {
        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        }, timeoutMs);
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            return {
                ok: false,
                reason: 'utmfy_error',
                status: response.status,
                detail
            };
        }
        return { ok: true };
    };

    let last = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        last = await sendOnce().catch((error) => ({
            ok: false,
            reason: 'utmfy_network_error',
            detail: error?.message || String(error)
        }));
        if (last?.ok) return last;
        const status = Number(last?.status || 0);
        const retryable = !status || status === 408 || status === 429 || status >= 500;
        if (!retryable || attempt === 2) return last;
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    }

    return last || { ok: false, reason: 'utmfy_unknown_error' };
}

module.exports = {
    sendUtmfy
};
