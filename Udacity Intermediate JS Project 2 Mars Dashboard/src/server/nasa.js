// ------------------------------------------------------  NASA SOURCES
// URL builders are pure. Network access only happens through the `fetchJson`
// function that is passed in (dependency injection), which keeps this module
// testable and keeps side effects at the edge of the app.

const {
    buildUrl,
    redactKey,
    hasPhotos,
    fromLegacyLatest,
    fromRawFeed,
    fromLibrarySearch,
} = require('./transform')

const API_ROOT = 'https://api.nasa.gov'

const urls = Object.freeze({
    apod: (apiKey) => buildUrl(`${API_ROOT}/planetary/apod`, { api_key: apiKey }),
    legacyLatest: (facts, apiKey) =>
        buildUrl(`${API_ROOT}/mars-photos/api/v1/rovers/${facts.name.toLowerCase()}/latest_photos`, { api_key: apiKey }),
    rawFeed: (facts) =>
        buildUrl('https://mars.nasa.gov/api/v1/raw_image_items/', {
            order: 'sol desc,date_taken desc',
            per_page: 50,
            page: 0,
            condition_1: `${facts.rawImageMission}:mission`,
        }),
    library: (facts) =>
        buildUrl('https://images-api.nasa.gov/search', { q: `${facts.name} rover Mars`, media_type: 'image' }),
})

// Higher-order: describes one data source and returns a runner for it
const makeSource = ({ id, label, applies, toUrl, toResult }) =>
    Object.freeze({
        id,
        label,
        applies,
        run: (fetchJson) => (facts, apiKey) => fetchJson(toUrl(facts, apiKey)).then(toResult(facts)),
    })

// Ordered fallback chain: the first source that returns photos wins
const SOURCES = Object.freeze([
    makeSource({
        id: 'mars-photos',
        label: 'NASA Mars Rover Photos API',
        applies: () => true,
        toUrl: urls.legacyLatest,
        toResult: () => fromLegacyLatest,
    }),
    makeSource({
        id: 'raw-images',
        label: 'NASA raw image feed',
        applies: (facts) => Boolean(facts.rawImageMission),
        toUrl: urls.rawFeed,
        toResult: () => fromRawFeed,
    }),
    makeSource({
        id: 'image-library',
        label: 'NASA Image and Video Library',
        applies: () => true,
        toUrl: urls.library,
        toResult: (facts) => fromLibrarySearch(facts.name),
    }),
])

const sourcesFor = (facts) => SOURCES.filter((source) => source.applies(facts))

// Tries each source in order. Resolves to { result, source } or { result: null, source: null, errors }
const fetchRoverPhotos = (fetchJson, log = () => {}) => (facts, apiKey) =>
    sourcesFor(facts).reduce(
        (previous, source) =>
            previous.then((outcome) =>
                outcome.result
                    ? outcome
                    : source
                          .run(fetchJson)(facts, apiKey)
                          .then((result) =>
                              hasPhotos(result)
                                  ? { result, source: { id: source.id, label: source.label }, errors: outcome.errors }
                                  : { ...outcome, errors: [...outcome.errors, `${source.id}: no photos`] }
                          )
                          .catch((err) => {
                              log(`[${facts.name}] ${source.id} failed: ${redactKey(err.message)}`)
                              return { ...outcome, errors: [...outcome.errors, `${source.id}: ${redactKey(err.message)}`] }
                          })
            ),
        Promise.resolve({ result: null, source: null, errors: [] })
    )

module.exports = { urls, SOURCES, sourcesFor, makeSource, fetchRoverPhotos }
