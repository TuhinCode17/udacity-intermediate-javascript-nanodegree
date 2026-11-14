// ------------------------------------------------------  HTTP EDGE
// The only place the server touches the network. Wraps a fetch implementation
// so every call gets a timeout and a clear error on non-2xx responses.

const { redactKey } = require('./transform')

const makeFetchJson = (fetchFn, timeoutMs = 12000) => (url) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    return fetchFn(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        .then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} from ${redactKey(url)}`)
            }
            return res.json()
        })
        .finally(() => clearTimeout(timer))
}

module.exports = { makeFetchJson }
