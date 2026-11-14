// ------------------------------------------------------  PURE TRANSFORMS
// Every function in this file is pure: same input -> same output, no I/O,
// no mutation. They reshape raw NASA responses into the small, predictable
// shape the frontend consumes.

const MAX_PHOTOS = 24

// ---------- generic helpers

const buildUrl = (base, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return query ? `${base}?${query}` : base
}

// Hides the API key if a URL is ever logged
const redactKey = (url) => String(url).replace(/api_key=[^&]+/g, 'api_key=***')

const resolveApiKey = (env) => (env && env.API_KEY && env.API_KEY !== 'YOUR_API_KEY' ? env.API_KEY : 'DEMO_KEY')

const toIsoDay = (value) => (value ? String(value).slice(0, 10) : null)

const normalizeRoverName = (name) => String(name || '').trim().toLowerCase()

const isKnownRover = (knownNames) => (name) =>
    knownNames.map(normalizeRoverName).includes(normalizeRoverName(name))

// Higher-order: returns a function that keeps the first n items
const takeFirst = (n) => (items) => items.slice(0, n)

const sortByDateDesc = (photos) =>
    [...photos].sort((a, b) => String(b.earthDate).localeCompare(String(a.earthDate)))

const hasPhotos = (result) => Boolean(result && Array.isArray(result.photos) && result.photos.length > 0)

const latestDate = (photos) =>
    photos.reduce((latest, photo) => (photo.earthDate && photo.earthDate > latest ? photo.earthDate : latest), '') || null

// Keeps only photos from the newest sol (for feeds that return several sols)
const onlyLatestSol = (photos) => {
    const maxSol = photos.reduce((max, p) => (typeof p.sol === 'number' && p.sol > max ? p.sol : max), -1)
    return maxSol < 0 ? photos : photos.filter((p) => p.sol === maxSol)
}

// [{camera:'NAVCAM'},{camera:'NAVCAM'},{camera:'MAST'}] -> [{name:'NAVCAM',count:2},{name:'MAST',count:1}]
const countByCamera = (photos) => {
    const counts = photos.reduce(
        (acc, photo) => ({ ...acc, [photo.camera]: (acc[photo.camera] || 0) + 1 }),
        {}
    )
    return Object.keys(counts)
        .map((name) => ({ name, count: counts[name] }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// ---------- normalizers: each NASA source -> { id, src, camera, earthDate, sol, title }

// Legacy api.nasa.gov/mars-photos (archived Oct 2025)
const normalizeLegacyPhoto = (photo) => ({
    id: `legacy-${photo.id}`,
    src: String(photo.img_src || '').replace(/^http:/, 'https:'),
    camera: (photo.camera && (photo.camera.full_name || photo.camera.name)) || 'Unknown camera',
    earthDate: toIsoDay(photo.earth_date),
    sol: typeof photo.sol === 'number' ? photo.sol : null,
    title: null,
})

// mars.nasa.gov raw image feed (Curiosity)
const normalizeRawImage = (item) => {
    const files = item.image_files || {}
    return {
        id: `raw-${item.id}`,
        src: files.medium || files.large || item.https_url || item.url || '',
        camera: item.instrument || 'Unknown camera',
        earthDate: toIsoDay(item.date_taken || item.date_received),
        sol: typeof item.sol === 'number' ? item.sol : null,
        title: item.title || null,
    }
}

// images-api.nasa.gov (NASA Image and Video Library)
const normalizeLibraryItem = (item) => {
    const data = (item.data && item.data[0]) || {}
    const links = item.links || []
    const preview = links.find((link) => link.rel === 'preview') || links[0] || {}
    return {
        id: `library-${data.nasa_id || preview.href}`,
        src: preview.href || '',
        camera: data.center ? `NASA ${data.center}` : 'NASA Image Library',
        earthDate: toIsoDay(data.date_created),
        sol: null,
        title: data.title || null,
    }
}

const hasSource = (photo) => Boolean(photo.src)

// ---------- response -> result  ({ photos, live }) where live = rover facts from the API, if any

const fromLegacyLatest = (json) => {
    const raw = (json && json.latest_photos) || []
    const rover = (raw[0] && raw[0].rover) || null
    return {
        photos: takeFirst(MAX_PHOTOS)(raw.map(normalizeLegacyPhoto).filter(hasSource)),
        live: rover
            ? {
                  launchDate: rover.launch_date,
                  landingDate: rover.landing_date,
                  status: rover.status,
                  maxSol: rover.max_sol,
                  totalPhotos: rover.total_photos,
              }
            : null,
    }
}

const fromRawFeed = (json) => {
    const items = (json && json.items) || []
    const photos = onlyLatestSol(items.map(normalizeRawImage).filter(hasSource))
    return { photos: takeFirst(MAX_PHOTOS)(sortByDateDesc(photos)), live: null }
}

// Library search is broad, so keep only items that mention the rover by name
const mentionsRover = (roverName) => (item) => {
    const data = (item.data && item.data[0]) || {}
    const haystack = [data.title, data.description, ...(data.keywords || [])].join(' ').toLowerCase()
    return haystack.includes(roverName.toLowerCase())
}

const fromLibrarySearch = (roverName) => (json) => {
    const items = (json && json.collection && json.collection.items) || []
    const photos = items.filter(mentionsRover(roverName)).map(normalizeLibraryItem).filter(hasSource)
    return { photos: takeFirst(MAX_PHOTOS)(sortByDateDesc(photos)), live: null }
}

// ---------- final payloads sent to the browser

const stripInternal = ({ rawImageMission, ...publicFacts }) => publicFacts

const buildRoverPayload = (facts, result, source) => {
    const photos = (result && result.photos) || []
    const live = (result && result.live) || {}
    return {
        ...stripInternal(facts),
        ...Object.keys(live).reduce((acc, key) => (live[key] != null ? { ...acc, [key]: live[key] } : acc), {}),
        latestPhotoDate: latestDate(photos),
        cameras: countByCamera(photos),
        photos,
        source: source || null,
    }
}

const buildApodPayload = (json) => ({
    title: json.title || '',
    date: json.date || null,
    mediaType: json.media_type || 'image',
    url: json.url || '',
    hdurl: json.hdurl || null,
    explanation: json.explanation || '',
    copyright: json.copyright ? String(json.copyright).trim() : null,
})

module.exports = {
    MAX_PHOTOS,
    buildUrl,
    redactKey,
    resolveApiKey,
    toIsoDay,
    normalizeRoverName,
    isKnownRover,
    takeFirst,
    sortByDateDesc,
    hasPhotos,
    latestDate,
    onlyLatestSol,
    countByCamera,
    normalizeLegacyPhoto,
    normalizeRawImage,
    normalizeLibraryItem,
    fromLegacyLatest,
    fromRawFeed,
    fromLibrarySearch,
    mentionsRover,
    buildRoverPayload,
    buildApodPayload,
}
