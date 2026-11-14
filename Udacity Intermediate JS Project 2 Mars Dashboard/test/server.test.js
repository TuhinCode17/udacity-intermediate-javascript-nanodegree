// Run with: yarn test   (uses Node's built-in test runner, no extra dependencies)
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const T = require('../src/server/transform')
const { ROVERS } = require('../src/server/rovers')
const { fetchRoverPhotos, sourcesFor } = require('../src/server/nasa')
const { createApp } = require('../src/server/app')
const F = require('./fixtures')

// ---------- pure functions

test('buildUrl encodes params and resolveApiKey falls back to DEMO_KEY', () => {
    assert.equal(T.buildUrl('https://x.test/a', { q: 'a b', n: 2 }), 'https://x.test/a?q=a+b&n=2')
    assert.equal(T.resolveApiKey({}), 'DEMO_KEY')
    assert.equal(T.resolveApiKey({ API_KEY: 'YOUR_API_KEY' }), 'DEMO_KEY')
    assert.equal(T.resolveApiKey({ API_KEY: 'abc' }), 'abc')
})

test('redactKey hides the API key', () => {
    assert.equal(T.redactKey('https://api.nasa.gov/x?api_key=SECRET&a=1'), 'https://api.nasa.gov/x?api_key=***&a=1')
})

test('countByCamera groups and sorts with reduce', () => {
    const photos = [{ camera: 'B' }, { camera: 'A' }, { camera: 'B' }]
    assert.deepEqual(T.countByCamera(photos), [{ name: 'B', count: 2 }, { name: 'A', count: 1 }])
})

test('transforms do not mutate their input', () => {
    const photos = Object.freeze([Object.freeze({ earthDate: '2020-01-01' }), Object.freeze({ earthDate: '2021-01-01' })])
    assert.equal(T.sortByDateDesc(photos)[0].earthDate, '2021-01-01')
    assert.equal(photos[0].earthDate, '2020-01-01')
})

test('fromLegacyLatest normalizes photos, forces https and reads live rover facts', () => {
    const { photos, live } = T.fromLegacyLatest(F.legacyLatest)
    assert.equal(photos.length, 2)
    assert.equal(photos[0].src, 'https://mars.nasa.gov/a.jpg')
    assert.equal(photos[0].camera, 'Navigation Camera')
    assert.equal(live.maxSol, 4102)
})

test('fromRawFeed keeps only the newest sol', () => {
    const { photos } = T.fromRawFeed(F.rawFeed)
    assert.equal(photos.length, 10)
    assert.ok(photos.every((p) => p.sol === 4710))
})

test('fromLibrarySearch filters unrelated items and sorts newest first', () => {
    const { photos } = T.fromLibrarySearch('Spirit')(F.library('Spirit'))
    assert.equal(photos.length, 10)
    assert.ok(!photos.some((p) => p.title === 'Jupiter storm'))
    assert.ok(photos[0].earthDate >= photos[photos.length - 1].earthDate)
})

test('buildRoverPayload never leaks internal fields and has required info', () => {
    const payload = T.buildRoverPayload(ROVERS.spirit, { photos: [], live: null }, null)
    assert.equal(payload.rawImageMission, undefined)
    for (const key of ['name', 'launchDate', 'landingDate', 'status', 'photos', 'latestPhotoDate']) {
        assert.ok(key in payload, key)
    }
})

test('source chain: Curiosity has raw feed, Spirit does not', () => {
    assert.deepEqual(sourcesFor(ROVERS.curiosity).map((s) => s.id), ['mars-photos', 'raw-images', 'image-library'])
    assert.deepEqual(sourcesFor(ROVERS.spirit).map((s) => s.id), ['mars-photos', 'image-library'])
})

// ---------- fallback behaviour with a fake fetch

const fakeFetch = ({ legacyWorks }) => (url) => {
    if (url.includes('/planetary/apod')) return Promise.resolve(F.apod)
    if (url.includes('/mars-photos/')) {
        return legacyWorks ? Promise.resolve(F.legacyLatest) : Promise.reject(new Error(`HTTP 404 from ${T.redactKey(url)}`))
    }
    if (url.includes('raw_image_items')) return Promise.resolve(F.rawFeed)
    if (url.includes('images-api.nasa.gov')) {
        const rover = ['Spirit', 'Opportunity', 'Curiosity'].find((name) => url.includes(name))
        return Promise.resolve(F.library(rover))
    }
    return Promise.reject(new Error('unexpected url'))
}

test('uses the legacy API when it works', async () => {
    const { source } = await fetchRoverPhotos(fakeFetch({ legacyWorks: true }))(ROVERS.curiosity, 'k')
    assert.equal(source.id, 'mars-photos')
})

test('falls back to raw feed for Curiosity and library for Spirit when legacy API is down', async () => {
    const run = fetchRoverPhotos(fakeFetch({ legacyWorks: false }))
    assert.equal((await run(ROVERS.curiosity, 'k')).source.id, 'raw-images')
    assert.equal((await run(ROVERS.spirit, 'k')).source.id, 'image-library')
})

test('reports errors when every source fails', async () => {
    const out = await fetchRoverPhotos(() => Promise.reject(new Error('offline')))(ROVERS.opportunity, 'k')
    assert.equal(out.result, null)
    assert.equal(out.errors.length, 2)
})

// ---------- HTTP routes

const withServer = async (app, fn) => {
    const server = http.createServer(app)
    await new Promise((r) => server.listen(0, r))
    try {
        return await fn(`http://127.0.0.1:${server.address().port}`)
    } finally {
        server.close()
    }
}

test('routes: /apod, /rovers/:name, 404 and the key never reaches the client', async () => {
    const seen = []
    const app = createApp({
        fetchJson: (url) => (seen.push(url), fakeFetch({ legacyWorks: false })(url)),
        apiKey: 'TOP_SECRET',
        log: () => {},
    })
    await withServer(app, async (base) => {
        const apodRes = await fetch(`${base}/apod`)
        const apodText = await apodRes.text()
        assert.equal(apodRes.status, 200)
        assert.equal(JSON.parse(apodText).apod.copyright, 'Mauricio Salazar')

        const roverText = await (await fetch(`${base}/rovers/Opportunity`)).text()
        const { rover } = JSON.parse(roverText)
        assert.equal(rover.name, 'Opportunity')
        assert.equal(rover.landingDate, '2004-01-25')
        assert.ok(rover.photos.length > 0)

        assert.equal((await fetch(`${base}/rovers/pluto`)).status, 404)
        assert.ok(!apodText.includes('TOP_SECRET') && !roverText.includes('TOP_SECRET'))
        assert.ok(seen.some((u) => u.includes('api_key=TOP_SECRET')), 'key is sent to NASA')
    })
})
