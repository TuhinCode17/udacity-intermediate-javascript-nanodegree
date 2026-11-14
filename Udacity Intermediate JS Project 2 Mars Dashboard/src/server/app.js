// ------------------------------------------------------  EXPRESS APP
// Express acts as the middleman: the browser asks this server for data,
// the server calls NASA with the secret API key, reshapes the response with
// pure functions and sends back only what the UI needs. The key never
// reaches the browser.

const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')

const { ROVERS, ROVER_NAMES } = require('./rovers')
const { normalizeRoverName, isKnownRover, buildRoverPayload, buildApodPayload, redactKey } = require('./transform')
const { urls, fetchRoverPhotos } = require('./nasa')

const createApp = ({ fetchJson, apiKey, log = console.log }) => {
    const app = express()
    const isRover = isKnownRover(ROVER_NAMES)
    const getRoverPhotos = fetchRoverPhotos(fetchJson, log)

    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())

    app.use('/', express.static(path.join(__dirname, '../public')))
    app.use('/vendor', express.static(path.join(__dirname, '../../node_modules/immutable/dist')))

    // Astronomy Picture of the Day (used as the page background)
    app.get('/apod', async (req, res) => {
        try {
            const json = await fetchJson(urls.apod(apiKey))
            res.send({ apod: buildApodPayload(json) })
        } catch (err) {
            log('APOD error:', redactKey(err.message))
            res.status(502).send({ error: 'Could not load the Astronomy Picture of the Day.' })
        }
    })

    // List of rovers for the selection tabs
    app.get('/rovers', (req, res) => {
        res.send({ rovers: ROVER_NAMES })
    })

    // Facts + most recent photos for one rover
    app.get('/rovers/:name', async (req, res) => {
        const key = normalizeRoverName(req.params.name)

        if (!isRover(key)) {
            return res.status(404).send({ error: `Unknown rover "${req.params.name}".` })
        }

        const facts = ROVERS[key]
        const { result, source, errors } = await getRoverPhotos(facts, apiKey)

        return res.send({
            rover: buildRoverPayload(facts, result, source),
            ...(result ? {} : { warning: 'No photo source responded. Showing mission facts only.', errors }),
        })
    })

    return app
}

module.exports = { createApp }
