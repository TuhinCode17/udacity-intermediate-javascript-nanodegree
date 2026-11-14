// Offline preview: runs the real Express app with NASA calls replaced by fixtures.
// The legacy Mars Photos API is simulated as archived (404) so the fallback chain is exercised.
// Usage: node test/mock-server.js   ->  http://localhost:3001
const { createApp } = require('../src/server/app')
const F = require('./fixtures')

const fakeFetch = (url) => {
    if (url.includes('/planetary/apod')) return Promise.resolve(F.apod)
    if (url.includes('/mars-photos/')) return Promise.reject(new Error('HTTP 404 (archived)'))
    if (url.includes('raw_image_items')) return Promise.resolve(F.rawFeed)
    if (url.includes('images-api.nasa.gov')) {
        const rover = ['Spirit', 'Opportunity', 'Curiosity'].find((name) => url.includes(name))
        return new Promise((resolve) => setTimeout(() => resolve(F.library(rover)), 300))
    }
    return Promise.reject(new Error('unexpected url'))
}

const app = createApp({ fetchJson: fakeFetch, apiKey: 'MOCK', log: () => {} })

// Simple generated "Mars terrain" placeholder images
app.get('/mock-img/:n.svg', (req, res) => {
    const n = Number.parseInt(req.params.n, 10) || 0
    const hue = 10 + ((n * 7) % 25)
    const sky = req.params.n === 'apod' ? '#0b1030' : `hsl(${hue + 10}, 35%, ${55 + (n % 4) * 5}%)`
    res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
        <rect width="400" height="400" fill="${sky}"/>
        <path d="M0 ${220 + (n % 5) * 12} Q 100 ${170 + (n % 3) * 20} 200 ${210 + (n % 4) * 10} T 400 ${200 + (n % 6) * 8} V400 H0Z" fill="hsl(${hue}, 60%, 38%)"/>
        <path d="M0 ${300 + (n % 3) * 10} Q 150 ${270 + (n % 4) * 8} 400 ${310 - (n % 5) * 6} V400 H0Z" fill="hsl(${hue}, 55%, 26%)"/>
        <circle cx="${60 + (n * 37) % 280}" cy="${330 + (n % 3) * 15}" r="${6 + (n % 4) * 3}" fill="hsl(${hue}, 40%, 18%)"/>
    </svg>`)
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`Mock Mars Dashboard on http://localhost:${port}`))
