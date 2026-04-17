const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

function asObject(input) {
    return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function normalizeStatus(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');
}

function getAtomopayTxid(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    return String(
        pick(
            root.transaction_hash,
            root.transactionHash,
            root.hash,
            root.id,
            nested.transaction_hash,
            nested.transactionHash,
            nested.hash,
            nested.id
        ) || ''
    ).trim();
}

function getAtomopayStatus(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    return normalizeStatus(
        pick(
            root.status,
            nested.status
        )
    );
}

function getAtomopayUpdatedAt(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    return pick(
        root.paid_at,
        root.paidAt,
        nested.paid_at,
        nested.paidAt,
        root.refunded_at,
        root.refundedAt,
        nested.refunded_at,
        nested.refundedAt,
        root.canceled_at,
        root.canceledAt,
        nested.canceled_at,
        nested.canceledAt,
        root.updated_at,
        root.updatedAt,
        nested.updated_at,
        nested.updatedAt,
        root.expires_at,
        root.expiresAt,
        nested.expires_at,
        nested.expiresAt,
        root.created_at,
        root.createdAt,
        nested.created_at,
        nested.createdAt
    ) || null;
}

function getAtomopayAmount(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const rawValue = pick(
        root.amount,
        root.total_amount,
        nested.amount,
        nested.total_amount,
        0
    );
    if (rawValue === undefined || rawValue === null || rawValue === '') return 0;
    const rawText = String(rawValue).trim();
    if (!rawText) return 0;
    const normalized = rawText.replace(',', '.');
    const amountRaw = Number(normalized);
    if (!Number.isFinite(amountRaw)) return 0;
    const hasDecimalMark = /[.,]/.test(rawText);
    if (hasDecimalMark) return Number(amountRaw.toFixed(2));
    if (Number.isInteger(amountRaw) && Math.abs(amountRaw) >= 100) {
        return Number((amountRaw / 100).toFixed(2));
    }
    return Number(amountRaw.toFixed(2));
}

function getAtomopayTracking(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    return asObject(nested.tracking || root.tracking);
}

function getAtomopayCustomer(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    return asObject(nested.customer || root.customer);
}

function resolveAtomopayPixPayload(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const qrRaw = String(
        pick(
            root.qr_code,
            root.qrCode,
            nested.qr_code,
            nested.qrCode
        ) || ''
    ).trim();
    const paymentCode = String(
        pick(
            root.pix_code,
            root.pixCode,
            nested.pix_code,
            nested.pixCode
        ) || ''
    ).trim();

    let paymentCodeBase64 = '';
    let paymentQrUrl = '';
    if (qrRaw) {
        if (/^https?:\/\//i.test(qrRaw) || qrRaw.startsWith('data:image')) {
            paymentQrUrl = qrRaw;
        } else {
            paymentCodeBase64 = qrRaw;
        }
    }

    return {
        txid: getAtomopayTxid(payload),
        status: getAtomopayStatus(payload),
        amount: getAtomopayAmount(payload),
        paymentCode,
        paymentCodeBase64,
        paymentQrUrl
    };
}

function isAtomopayPaidStatus(statusRaw) {
    return normalizeStatus(statusRaw) === 'paid';
}

function isAtomopayRefundedStatus(statusRaw) {
    return normalizeStatus(statusRaw) === 'refunded';
}

function isAtomopayRefusedStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['canceled', 'cancelled', 'expired', 'failed', 'refused', 'declined'].includes(status);
}

function isAtomopayPendingStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['pending', 'processing', 'created', 'waiting_payment', 'awaiting_payment'].includes(status);
}

function mapAtomopayStatusToUtmify(statusRaw) {
    if (isAtomopayPaidStatus(statusRaw)) return 'paid';
    if (isAtomopayRefundedStatus(statusRaw)) return 'refunded';
    if (isAtomopayRefusedStatus(statusRaw)) return 'refused';
    if (isAtomopayPendingStatus(statusRaw)) return 'waiting_payment';
    return 'waiting_payment';
}

module.exports = {
    normalizeStatus,
    getAtomopayTxid,
    getAtomopayStatus,
    getAtomopayUpdatedAt,
    getAtomopayAmount,
    getAtomopayTracking,
    getAtomopayCustomer,
    resolveAtomopayPixPayload,
    isAtomopayPaidStatus,
    isAtomopayRefundedStatus,
    isAtomopayRefusedStatus,
    isAtomopayPendingStatus,
    mapAtomopayStatusToUtmify
};
