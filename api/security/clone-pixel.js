const { recordCloneEvent } = require('../../lib/clone-detector-store');

const PIXEL = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

function setPixelHeaders(res) {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendPixel(res) {
    setPixelHeaders(res);
    res.status(200).send(PIXEL);
}

function pickBody(req) {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (_error) {
            return {};
        }
    }
    return typeof req.body === 'object' ? req.body : {};
}

module.exports = async (req, res) => {
    setPixelHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        sendPixel(res);
        return;
    }

    const payload = {
        ...pickBody(req),
        ...(req.query || {})
    };

    try {
        await recordCloneEvent(payload, req);
    } catch (error) {
        console.error('[clone-pixel] record failed', error);
    }

    sendPixel(res);
};
