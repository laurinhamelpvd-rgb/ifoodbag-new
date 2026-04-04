const { ensureAllowedRequest } = require('./request-guard');
const { findBlockedIp } = require('./ip-blacklist');

async function ensurePublicAccess(req, res, options = {}) {
    const { requireSession = false } = options;

    if (!ensureAllowedRequest(req, res, { requireSession })) {
        return false;
    }

    const blocked = await findBlockedIp(req);
    if (!blocked.ok) {
        return true;
    }

    if (blocked.blocked) {
        res.status(403).json({
            error: 'Acesso bloqueado.',
            blocked: true,
            code: 'ip_blocked',
            ip: blocked.ip
        });
        return false;
    }

    return true;
}

module.exports = {
    ensurePublicAccess
};
