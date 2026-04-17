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
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
    const pix = asObject(root.pix || nested.pix || transaction.pix || payment.pix);
    return String(
        pick(
            root.transaction_hash,
            root.transactionHash,
            root.hash,
            root.id,
            nested.transaction_hash,
            nested.transactionHash,
            nested.hash,
            nested.id,
            transaction.transaction_hash,
            transaction.transactionHash,
            transaction.hash,
            transaction.id,
            payment.transaction_hash,
            payment.transactionHash,
            payment.hash,
            payment.id,
            pix.transaction_hash,
            pix.transactionHash,
            pix.hash,
            pix.id
        ) || ''
    ).trim();
}

function getAtomopayStatus(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
    const pix = asObject(root.pix || nested.pix || transaction.pix || payment.pix);
    return normalizeStatus(
        pick(
            root.status,
            nested.status,
            root.raw_status,
            nested.raw_status,
            transaction.status,
            payment.status,
            pix.status
        )
    );
}

function getAtomopayUpdatedAt(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
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
        nested.createdAt,
        transaction.paid_at,
        transaction.paidAt,
        transaction.updated_at,
        transaction.updatedAt,
        transaction.created_at,
        transaction.createdAt,
        payment.paid_at,
        payment.paidAt,
        payment.updated_at,
        payment.updatedAt,
        payment.created_at,
        payment.createdAt
    ) || null;
}

function getAtomopayAmount(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
    const rawValue = pick(
        root.amount,
        root.total_amount,
        nested.amount,
        nested.total_amount,
        transaction.amount,
        transaction.total_amount,
        payment.amount,
        payment.total_amount,
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
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
    return asObject(nested.tracking || root.tracking || transaction.tracking || payment.tracking);
}

function getAtomopayCustomer(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
    return asObject(nested.customer || root.customer || transaction.customer || payment.customer);
}

function resolveAtomopayPixPayload(payload = {}) {
    const root = asObject(payload);
    const nested = asObject(root.data);
    const transaction = asObject(root.transaction || nested.transaction);
    const payment = asObject(root.payment || nested.payment);
    const pix = asObject(root.pix || nested.pix || transaction.pix || payment.pix);
    const qrRaw = String(
        pick(
            root.qr_code,
            root.qrCode,
            root.qrcode,
            nested.qr_code,
            nested.qrCode,
            nested.qrcode,
            transaction.qr_code,
            transaction.qrCode,
            transaction.qrcode,
            payment.qr_code,
            payment.qrCode,
            payment.qrcode,
            pix.qr_code,
            pix.qrCode,
            pix.qrcode,
            pix.qr_code_base64,
            pix.qrCodeBase64,
            pix.qrcodeBase64,
            pix.image,
            pix.imageBase64
        ) || ''
    ).trim();
    const paymentCode = String(
        pick(
            root.pix_code,
            root.pixCode,
            root.br_code,
            root.payload,
            nested.pix_code,
            nested.pixCode,
            nested.br_code,
            nested.payload,
            transaction.pix_code,
            transaction.pixCode,
            transaction.br_code,
            transaction.payload,
            payment.pix_code,
            payment.pixCode,
            payment.br_code,
            payment.payload,
            pix.pix_code,
            pix.pixCode,
            pix.br_code,
            pix.payload,
            pix.copyPaste,
            pix.copy_paste,
            pix.code
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
    const status = normalizeStatus(statusRaw);
    return status === 'refunded' || status === 'refund';
}

function isAtomopayRefusedStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['canceled', 'cancelled', 'expired', 'failed', 'refused', 'declined', 'antifraud'].includes(status);
}

function isAtomopayPendingStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['pending', 'processing', 'prossessing', 'created', 'waiting_payment', 'awaiting_payment', 'authorized', 'gerado'].includes(status);
}

function isAtomopayChargebackStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['chargedback', 'chargeback', 'charge_back'].includes(status);
}

function mapAtomopayStatusToUtmify(statusRaw) {
    if (isAtomopayPaidStatus(statusRaw)) return 'paid';
    if (isAtomopayRefundedStatus(statusRaw)) return 'refunded';
    if (isAtomopayChargebackStatus(statusRaw)) return 'chargedback';
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
    isAtomopayChargebackStatus,
    mapAtomopayStatusToUtmify
};
