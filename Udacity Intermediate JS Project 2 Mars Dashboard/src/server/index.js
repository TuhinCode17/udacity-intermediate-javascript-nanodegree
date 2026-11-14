require('dotenv').config()
const fetch = require('node-fetch')

const { createApp } = require('./app')
const { makeFetchJson } = require('./http')
const { resolveApiKey } = require('./transform')

const port = process.env.PORT || 3000
const apiKey = resolveApiKey(process.env)

if (apiKey === 'DEMO_KEY') {
    console.warn('No API_KEY found in .env - falling back to NASA DEMO_KEY (heavily rate limited).')
}

const app = createApp({ fetchJson: makeFetchJson(fetch), apiKey })

app.listen(port, () => console.log(`Mars Dashboard listening on port ${port}!`))
