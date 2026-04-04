const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

function normalizeStatus(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');
}

function getParadiseTxid(payload = {}) {
    return String(
        pick(
            payload?.transaction_id,
            payload?.transactionId,
            payload?.id,
            payload?.data?.transaction_id,
            payload?.data?.transactionId,
            payload?.data?.id
        ) || ''
    ).trim();
}

function getParadiseExternalId(payload = {}) {
    return String(
        pick(
            payload?.external_id,
            payload?.externalId,
            payload?.reference,
            payload?.id,
            payload?.data?.external_id,
            payload?.data?.externalId,
            payload?.data?.reference,
            payload?.data?.id
        ) || ''
    ).trim();
}

function getParadiseStatus(payload = {}) {
    const raw = pick(
        payload?.status,
        payload?.raw_status,
        payload?.data?.status,
        payload?.data?.raw_status
    );
    return normalizeStatus(raw);
}

function getParadiseUpdatedAt(payload = {}) {
    return pick(
        payload?.timestamp,
        payload?.updated_at,
        payload?.updatedAt,
        payload?.paid_at,
        payload?.paidAt,
        payload?.created_at,
        payload?.createdAt,
        payload?.data?.timestamp,
        payload?.data?.updated_at,
        payload?.data?.updatedAt,
        payload?.data?.paid_at,
        payload?.data?.paidAt,
        payload?.data?.created_at,
        payload?.data?.createdAt
    ) || null;
}

function getParadiseAmount(payload = {}) {
    const rawValue = pick(
        payload?.amount_in_reais,
        payload?.amountInReais,
        payload?.amount,
        payload?.data?.amount_in_reais,
        payload?.data?.amountInReais,
        payload?.data?.amount,
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

function isParadisePaidStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['approved', 'completed', 'paid', 'authorized', 'success'].includes(status);
}

function isParadiseRefundedStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['refunded', 'refund', 'reembolsado', 'estornado', 'devolvido'].includes(status);
}

function isParadiseChargebackStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['chargeback', 'charge_back', 'chargedback'].includes(status);
}

function isParadiseRefusedStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['failed', 'refused', 'declined', 'rejected', 'cancelled', 'canceled', 'expired', 'voided'].includes(status);
}

function isParadisePendingStatus(statusRaw) {
    const status = normalizeStatus(statusRaw);
    return ['pending', 'processing', 'under_review', 'review', 'in_review', 'waiting_payment', 'awaiting_payment', 'created'].includes(status);
}

function mapParadiseStatusToUtmify(statusRaw) {
    if (isParadisePaidStatus(statusRaw)) return 'paid';
    if (isParadiseRefundedStatus(statusRaw)) return 'refunded';
    if (isParadiseChargebackStatus(statusRaw)) return 'chargedback';
    if (isParadiseRefusedStatus(statusRaw)) return 'refused';
    if (isParadisePendingStatus(statusRaw)) return 'waiting_payment';
    return 'waiting_payment';
}

module.exports = {
    normalizeStatus,
    getParadiseTxid,
    getParadiseExternalId,
    getParadiseStatus,
    getParadiseUpdatedAt,
    getParadiseAmount,
    isParadisePaidStatus,
    isParadiseRefundedStatus,
    isParadiseChargebackStatus,
    isParadiseRefusedStatus,
    isParadisePendingStatus,
    mapParadiseStatusToUtmify
};
