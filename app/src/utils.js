const PIXI = require('pixi.js')

const FACTORS = {
    'n': 1 / 1000000000,
    'u': 1 / 1000000,
    'm': 1 / 1000,
    '': 1,
    'k': 1000,
    'M': Math.pow(1000, 2),
    'G': Math.pow(1000, 3),
    'T': Math.pow(1000, 4),
    'P': Math.pow(1000, 5),
    'E': Math.pow(1000, 6),
    'Ki': 1024,
    'Mi': Math.pow(1024, 2),
    'Gi': Math.pow(1024, 3),
    'Ti': Math.pow(1024, 4),
    'Pi': Math.pow(1024, 5),
    'Ei': Math.pow(1024, 6)
}

function hsvToRgb(h, s, v) {
    let r, g, b
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    switch (i % 6) {
    case 0:
        r = v
        g = t
        b = p
        break
    case 1:
        r = q
        g = v
        b = p
        break
    case 2:
        r = p
        g = v
        b = t
        break
    case 3:
        r = p
        g = q
        b = v
        break
    case 4:
        r = t
        g = p
        b = v
        break
    case 5:
        r = v
        g = p
        b = q
        break
    }
    return PIXI.utils.rgb2hex([r, g, b])
}

function getBarColor(usage, capacity) {
    return hsvToRgb(Math.max(0, Math.min(1, 0.4 - (0.4 * (usage / capacity)))), 0.6, 1)
}

function parseResource(v) {
    const match = v.match(/^(\d*)(\D*)$/)
    const factor = FACTORS[match[2]] || 1
    return parseInt(match[1]) * factor
}

const metric = (metric, type) =>
    metric ? (metric[type] ? parseResource(metric[type]) : 0) : 0

const podResource = type => (containers, resource) =>
    containers
        .map(({resources}) => resources ? metric(resources[resource], type) : 0)
        .reduce((a, b) => a + b, 0)

export {FACTORS, hsvToRgb, getBarColor, parseResource, metric, podResource}
