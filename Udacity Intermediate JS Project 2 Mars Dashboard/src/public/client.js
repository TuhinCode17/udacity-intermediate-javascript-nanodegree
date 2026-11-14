// =====================================================================
//  MARS ROVER DASHBOARD - client
//
//  Flow: click / data arrives -> updateStore() -> render() -> App(state) -> page
//  UI = f(state): the same state always produces the same page.
//
//  Concepts: immutability, pure functions, HOFs, closure, currying,
//            composition, map/filter, side effects at the edge.
//  Search the word to find the example.
// =====================================================================

// ------------------------------------------------------  1. STATE

// immutability: data is never changed in place. Every update creates a new
// Map and the old one stays as it was. Makes changes predictable and easy to track.
// Immutable.Map = key/value pairs, List = ordered items, Set = unique values only.
// `let` (not const) because `store` is re-pointed to the new Map on each update.
let store = Immutable.Map({
    user: Immutable.Map({ name: 'Student' }),
    apod: null, // null = not loaded yet
    apodError: null,
    rovers: Immutable.List(['Curiosity', 'Opportunity', 'Spirit']),
    selectedRover: 'Curiosity',
    roverData: Immutable.Map(), // rover name -> rover info
    roverErrors: Immutable.Map(), // rover name -> error message
    loadingRovers: Immutable.Set(), // Set: a rover is either loading or not
    today: new Date().toISOString().slice(0, 10), // 'YYYY-MM-DD', captured once so components stay pure
})

const root = document.getElementById('root')

// ------------------------------------------------------  2. PURE UTILS

// arrow function: (args) => expression
// With no { } the expression's value is returned automatically (implicit return).
//   const double = (x) => x * 2   ->   double(4) gives 8
// method chaining: each .replace() returns a new string that the next one works on.
// Escapes HTML-significant characters so API text is displayed as text,
// rather than interpreted as markup. This does not validate URL schemes.
// & must be replaced first, otherwise the & in '&lt;' would get escaped again.
// /g in a regex = replace every match, not just the first.
const escapeHtml = (value) =>
    String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

// pure function: same input -> same output, and nothing outside is changed.
// Test: can the call be swapped for its result? formatDate('2012-08-06') yes, fetch() no.
// guard clause: handle the bad case first and return early, so the main logic isn't nested.
// ternary: cond ? a : b  - a one-line if/else that produces a value,
// so it can be used after return or inside ${ }.
// '2012-08-06' -> 'Aug 6, 2012'; timeZone 'UTC' stops the date shifting by a day.
const formatDate = (isoDay) => {
    if (!isoDay) {
        return 'Unknown'
    }
    const date = new Date(`${isoDay}T00:00:00Z`)
    return Number.isNaN(date.getTime())
        ? escapeHtml(isoDay)
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// pure: 'today' is passed in as an argument instead of calling new Date() inside,
// so the result depends only on the inputs.
// Date - Date gives milliseconds; divided by one year in ms -> whole years.
const yearsBetween = (fromIso, toIso) => {
    const ms = new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`)
    return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)))
}

// 'unknown' -> 'Unknown'
const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '')

// state is passed in instead of reading the global store -> stays pure
const isRoverLoading = (state, name) => state.get('loadingRovers').includes(name)

// ------------------------------------------------------  3. HIGHER-ORDER FUNCTIONS

// HOF (higher-order function): a function that takes a function as input
// and/or returns a function. .map, .filter and addEventListener are HOFs too.
// a => b => ...  chained arrows = a function that returns another function.
//   listOf(renderItem, 'facts')  gives back a function
//   that function(items)         gives back '<ul class="facts">...</ul>'
// default param: className = '' is used when no class is passed.
//
// .map(fn): runs fn on every item and returns a NEW array of the results.
// The original array is not changed.
//   [1, 2, 3].map((n) => n * 2)  ->  [2, 4, 6]
//   ['a', 'b'].map((s) => `<li>${s}</li>`)  ->  ['<li>a</li>', '<li>b</li>']
// .join(''): glues an array into one string. Without it, the array's
// commas would show up on the page.
//   ['<li>a</li>', '<li>b</li>'].join('')  ->  '<li>a</li><li>b</li>'
const listOf = (renderItem, className = '') => (items) =>
    `<ul class="${className}">${items.map((item, index) => `<li>${renderItem(item, index)}</li>`).join('')}</ul>`

// template literal: backticks + ${ } put any expression inside a string.
//   `Hi ${name}`  ->  'Hi Sam'
// Only expressions work inside ${ }, that's why ternaries are used, not if.
// section('panel') returns a function that takes (title, body) and builds the HTML.
const section = (className) => (title, body) => `
    <section class="${className}">
        ${title ? `<h2 class="${className.split(' ')[0]}__title">${title}</h2>` : ''}
        ${body}
    </section>
`

// HOF that wraps a component and adds "if empty, show a message" behaviour.
// Called in three steps:
//   withFallback(isEmpty, fallback)  - how to test empty + what to show then
//   (component)                      - the normal component
//   (data)                           - the actual data
// Keeps the repeated empty-check logic in one place.
const withFallback = (isEmpty, fallback) => (component) => (data) => (isEmpty(data) ? fallback(data) : component(data))

// closure: a function remembers the variables from the place where it was
// created, even after that outer function has finished running.
//
// How it works:
//   const makeGreeter = (greeting) => (name) => `${greeting}, ${name}`
//   const sayHi = makeGreeter('Hi')   // makeGreeter has finished...
//   sayHi('Sam')                      // ...but 'Hi' is still remembered -> 'Hi, Sam'
//
// Each call creates its own separate closure:
//   makeGreeter('Hi') and makeGreeter('Hello') each keep their own 'greeting'.
//
// Here: section('panel') returns the inner (title, body) => ... function,
// and that function still has access to className = 'panel'.
// panel and heroPanel are two separate closures over two different class names.
//
// partial application: supplying some arguments now and the rest later.
// Closures are what make it work - the early arguments are stored inside.
//   panel('Title', '<p>body</p>')  ->  uses the remembered 'panel' class
//
// Closures also power the curried functions in this file:
//   RoverTab(selected)    remembers 'selected'
//   PhotoCard(roverName)  remembers 'roverName'
//   withFallback(...)     remembers isEmpty, fallback and component
//
// Why it's useful: configure a function once, reuse it everywhere,
// without global variables or passing the same argument repeatedly.
const panel = section('panel')
const heroPanel = section('panel panel--hero')

// ------------------------------------------------------  4. COMPONENTS (pure: data -> HTML string)

// declarative UI: describe WHAT the page should look like for this state,
// not step-by-step HOW to change the DOM.
// Each child component only gets the data it needs.
// state.get('key') reads one value from an Immutable Map.
// state.getIn(['a', 'b']) reads a nested value; gives undefined (no error) if missing.
const App = (state) => {
    const selected = state.get('selectedRover')
    const apod = state.get('apod')

    return `
        <div class="app" ${Background(apod)}>
            <div class="stars" aria-hidden="true"></div>
            ${Header(state.getIn(['user', 'name']))}
            <main class="layout">
                ${RoverTabs(state.get('rovers'), selected)}
                ${RoverDashboard(
                    selected,
                    state.getIn(['roverData', selected]),
                    state.getIn(['roverErrors', selected]),
                    isRoverLoading(state, selected),
                    state.get('today')
                )}
                ${ApodPanel(apod, state.get('apodError'))}
            </main>
            ${Footer()}
        </div>
    `
}

// && short-circuit: stops at the first falsy value. If apod is null,
// nothing after it runs, so .get() is never called on null.
// || returns the first truthy value: use hdurl if it exists, else url.
//   null || 'b'  ->  'b'        'a' || 'b'  ->  'a'
const Background = (apod) =>
    apod && apod.get('mediaType') === 'image' && apod.get('url')
        ? `style="--apod-bg: url('${escapeHtml(apod.get('hdurl') || apod.get('url'))}')"`
        : ''

const Header = (name) => `
    <header class="site-header">
        <p class="site-header__eyebrow">${name ? `Welcome, ${escapeHtml(name)}` : 'Welcome'}</p>
        <h1 class="site-header__title">Mars Rover <span>Dashboard</span></h1>
        <p class="site-header__lead">Choose a rover to see its mission facts and the most recent photos it sent home.</p>
    </header>
`

// currying: turning f(a, b) into f(a)(b), one argument at a time.
// .map() passes the current value, its key/index and the collection to the callback.
// RoverTab(selected) uses only the first argument (name); 'selected' is already remembered.
// data-rover is read back later by the click listener.
const RoverTab = (selected) => (name) => `
    <button
        class="tab ${name === selected ? 'tab--active' : ''}"
        type="button"
        role="tab"
        aria-selected="${name === selected}"
        data-rover="${escapeHtml(name)}">
        ${escapeHtml(name)}
    </button>
`

// Thanks to currying:
//   rovers.map(RoverTab(selected))
// instead of
//   rovers.map((name) => RoverTab(selected)(name))
// Immutable List .map() works like array .map(), returning a new List.
const RoverTabs = (rovers, selected) => `
    <nav class="tabs" role="tablist" aria-label="Choose a rover">
        ${rovers.map(RoverTab(selected)).join('')}
    </nav>
`

// async UI as state: loading, error and data are just values in the store.
// The component checks them in order and the first match wins:
// loading -> error -> no data yet -> success.
const RoverDashboard = (name, rover, error, loading, today) => {
    if (loading && !rover) {
        return Loading(name)
    }
    if (error && !rover) {
        return ErrorMessage(name, error)
    }
    if (!rover) {
        return Loading(name)
    }
    return `
        <div class="rover">
            ${heroPanel(`${escapeHtml(rover.get('name'))} ${StatusBadge(rover.get('status'))}`, RoverFacts(rover, today))}
            ${panel('Cameras on the latest batch', CameraBreakdown(rover.get('cameras')))}
            ${panel(
                `Most recent photos <small>${PhotoDateLabel(rover.get('latestPhotoDate'))}</small>`,
                Gallery(rover.get('photos'), rover.get('name'))
            )}
            ${SourceNote(rover.get('source'))}
        </div>
    `
}

// chained ternary: a ? x : b ? y : z  works like  if / else if / else.
// The CSS class comes from the data (badge--active), so colours stay in CSS.
const StatusBadge = (status) => {
    const value = String(status || 'unknown').toLowerCase()
    const label = value === 'active' ? 'Active' : value === 'complete' ? 'Mission complete' : capitalize(value)
    return `<span class="badge badge--${escapeHtml(value)}">${escapeHtml(label)}</span>`
}

// values are already escaped in roverFactRows, so not escaped again here
const FactItem = (fact) => `
    <span class="facts__label">${fact.label}</span>
    <span class="facts__value">${fact.value}</span>
`

// data first, HTML later: build plain { label, value } objects, render them after.
// .filter(fn): keeps only the items where fn returns true, in a NEW array.
//   [1, 2, 3, 4].filter((n) => n > 2)  ->  [3, 4]
// Here it drops facts whose value is null (data that's missing).
// The three main array tools:
//   map    = transform each item     (same length out)
//   filter = keep or drop items      (same or shorter)
//   reduce = combine into one value  (e.g. a total)
// reduce is included as a related concept; it isn't used in this client.js.
// != null keeps a real 0; a plain truthy check would wrongly hide it.
const roverFactRows = (rover, today) =>
    [
        { label: 'Mission', value: escapeHtml(rover.get('mission')) },
        { label: 'Launch date', value: formatDate(rover.get('launchDate')) },
        { label: 'Landing date', value: formatDate(rover.get('landingDate')) },
        { label: 'Landing site', value: escapeHtml(rover.get('landingSite')) },
        {
            label: 'Mission ended',
            value: rover.get('missionEnd') ? formatDate(rover.get('missionEnd')) : null,
        },
        {
            label: rover.get('missionEnd') ? 'Years on Mars' : 'Years on Mars so far',
            value: String(yearsBetween(rover.get('landingDate'), rover.get('missionEnd') || today)),
        },
        { label: 'Latest photo date', value: formatDate(rover.get('latestPhotoDate')) },
        { label: 'Latest sol', value: rover.get('maxSol') != null ? String(rover.get('maxSol')) : null },
        {
            label: 'Total photos',
            value: rover.get('totalPhotos') != null ? Number(rover.get('totalPhotos')).toLocaleString('en-US') : null,
        },
    ].filter((fact) => fact.value !== null)

// composition: the output of one function becomes the input of the next.
// Read inside-out: roverFactRows builds the data -> listOf(FactItem) turns it into HTML.
//   f(g(x))  =  "do g, then f"
const RoverFacts = (rover, today) => listOf(FactItem, 'facts')(roverFactRows(rover, today))

// camera is an Immutable Map: { name, count }
const CameraChip = (camera) => `
    <span class="chip">${escapeHtml(camera.get('name'))} <b>${camera.get('count')}</b></span>
`

// Built only by combining HOFs (withFallback + listOf), no function body of its own.
// .toArray(): converts an Immutable List into a plain JS array.
const CameraBreakdown = withFallback(
    (cameras) => !cameras || cameras.isEmpty(),
    () => '<p class="muted">No camera data for this batch.</p>'
)((cameras) => listOf(CameraChip, 'chips')(cameras.toArray()))

const PhotoDateLabel = (isoDay) => (isoDay ? `taken ${formatDate(isoDay)}` : '')

// currying again: roverName first, so photos.map(PhotoCard(roverName)) works.
// Sol = one Martian day, counted from landing.
const PhotoCard = (roverName) => (photo) => `
    <figure class="photo">
        <a href="${escapeHtml(photo.get('src'))}" target="_blank" rel="noopener" class="photo__link">
            <img
                src="${escapeHtml(photo.get('src'))}"
                alt="${escapeHtml(photo.get('title') || `${roverName} photo from ${photo.get('camera')}`)}"
                loading="lazy">
        </a>
        <figcaption class="photo__caption">
            <span>${escapeHtml(photo.get('camera'))}</span>
            <span>${photo.get('sol') != null ? `Sol ${photo.get('sol')} · ` : ''}${formatDate(photo.get('earthDate'))}</span>
        </figcaption>
    </figure>
`

// Same withFallback HOF, but built inside a function because the
// fallback message needs roverName.
const Gallery = (photos, roverName) =>
    withFallback(
        (list) => !list || list.isEmpty(),
        () => `<p class="muted">No photos are available for ${escapeHtml(roverName)} right now.</p>`
    )((list) => `<div class="gallery">${list.map(PhotoCard(roverName)).join('')}</div>`)(photos)

const SourceNote = (source) =>
    source
        ? `<p class="source-note">Photos via ${escapeHtml(source.get('label'))}.</p>`
        : '<p class="source-note">No photo source responded. Showing mission facts only.</p>'

// same async pattern as RoverDashboard: error -> loading -> success
const ApodPanel = (apod, error) => {
    if (error) {
        return panel('Astronomy Picture of the Day', `<p class="muted">${escapeHtml(error)}</p>`)
    }
    if (!apod) {
        return panel('Astronomy Picture of the Day', '<p class="muted">Loading...</p>')
    }
    // const + ternary instead of let + if/else: the value is decided once
    // and never reassigned, which keeps the function easier to follow.
    const media =
        apod.get('mediaType') === 'video'
            ? `<p><a href="${escapeHtml(apod.get('url'))}" target="_blank" rel="noopener">Watch today's featured video</a></p>`
            : `<img class="apod__image" src="${escapeHtml(apod.get('url'))}" alt="${escapeHtml(apod.get('title'))}" loading="lazy">`

    return panel(
        'Astronomy Picture of the Day',
        `
        <div class="apod">
            ${media}
            <div class="apod__text">
                <h3>${escapeHtml(apod.get('title'))}</h3>
                <p class="muted">${formatDate(apod.get('date'))}${apod.get('copyright') ? ` · © ${escapeHtml(apod.get('copyright'))}` : ''}</p>
                <p>${escapeHtml(apod.get('explanation'))}</p>
            </div>
        </div>
    `
    )
}

// role="status" = screen readers announce it politely
const Loading = (name) => `
    <div class="loading" role="status">
        <span class="loading__planet" aria-hidden="true"></span>
        <p>Contacting ${escapeHtml(name)}...</p>
    </div>
`

// role="alert" = announced immediately; data-retry is read by the click listener
const ErrorMessage = (name, message) => `
    <div class="error" role="alert">
        <p>Couldn't load ${escapeHtml(name)}: ${escapeHtml(message)}</p>
        <button class="tab" type="button" data-retry="${escapeHtml(name)}">Try again</button>
    </div>
`

const Footer = () => `
    <footer class="site-footer">
        <p>Data: NASA Open APIs · Mars rover photos courtesy NASA/JPL-Caltech</p>
    </footer>
`

// ------------------------------------------------------  5. EDGE (impure: DOM, events, network)

// side effects = anything that touches the outside world: the DOM, the network,
// global variables, event listeners. They all live here.
// "Functional core, imperative shell": sections 2-4 decide WHAT to show,
// this section actually DOES things.

// only place the page changes: UI = f(state).
// Redraws everything each time - fine for an app this size.
const render = (rootElement, state) => {
    rootElement.innerHTML = App(state)
}

// only place the store changes.
// .merge(obj): returns a NEW Map with the given keys updated.
// It's shallow - only top-level keys are replaced, so nested Maps
// (like roverData) are built first and then passed in whole.
const updateStore = (state, newState) => {
    store = state.merge(newState)
    render(root, store)
}

// promise: a value that arrives later (like a network response).
// .then(fn) runs when it succeeds; any error or rejection skips ahead to .catch().
// fetch only rejects on network failure - a 404 or 500 still "succeeds",
// so res.ok has to be checked by hand.
// Promise.reject(...) inside .then() jumps to the nearest .catch() (same as throw).
const getJson = (url) =>
    fetch(url).then((res) =>
        res.ok ? res.json() : res.json().then((body) => Promise.reject(new Error(body.error || `Request failed (${res.status})`)))
    )

// destructuring: pull a property out of an object straight into a variable.
//   const { apod } = data   is the same as   const apod = data.apod
// Works in parameters too: ({ apod }) => ...
// Immutable.fromJS(): deep-converts plain JSON into Immutable Maps and Lists.
// Errors become state, and state becomes UI.
const getImageOfTheDay = () =>
    getJson('/apod')
        .then(({ apod }) => updateStore(store, { apod: Immutable.fromJS(apod), apodError: null }))
        .catch((err) => updateStore(store, { apodError: err.message }))

// Three store updates: mark as loading -> then success OR error.
// Immutable .set() / .add() / .delete() return NEW collections;
// the old ones stay unchanged.
//   Map.set(key, value)   Set.add(value)
//   Map.delete(key)       Set.delete(value)
// Handlers read the CURRENT store when they run (not a stale copy),
// so a tab click made while waiting isn't lost.
const getRover = (name) => {
    updateStore(store, {
        loadingRovers: store.get('loadingRovers').add(name),
        roverErrors: store.get('roverErrors').delete(name),
    })

    return getJson(`/rovers/${encodeURIComponent(name.toLowerCase())}`)
        .then(({ rover }) =>
            updateStore(store, {
                roverData: store.get('roverData').set(name, Immutable.fromJS(rover)),
                loadingRovers: store.get('loadingRovers').delete(name),
            })
        )
        .catch((err) =>
            updateStore(store, {
                roverErrors: store.get('roverErrors').set(name, err.message),
                loadingRovers: store.get('loadingRovers').delete(name),
            })
        )
}

// The tab highlight moves right away; data is fetched only if it's
// not cached and not already loading (also stops double requests from fast clicks).
const selectRover = (name) => {
    updateStore(store, { selectedRover: name })
    if (!store.get('roverData').has(name) && !isRoverLoading(store, name)) {
        getRover(name)
    }
}

// event delegation: one listener on a parent instead of one per button.
// render() replaces the buttons every time, but #root is never replaced,
// so the listener on it keeps working.
// Clicks "bubble" up from the clicked element through its parents.
// closest(selector): walks up from the clicked element to the nearest match.
// data-rover="x" in HTML  ->  element.dataset.rover in JS
root.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-rover]')
    const retry = event.target.closest('[data-retry]')
    if (tab) {
        selectRover(tab.dataset.rover)
    } else if (retry) {
        getRover(retry.dataset.retry)
    }
})

// 'load' fires once everything on the page has loaded (including Immutable.js).
// Then the first render happens, and the APOD and rover requests run in parallel;
// each one re-renders the page when it comes back.
window.addEventListener('load', () => {
    render(root, store)
    getImageOfTheDay()
    selectRover(store.get('selectedRover'))
})