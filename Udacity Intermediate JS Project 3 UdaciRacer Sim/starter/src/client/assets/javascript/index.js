// ============================================================
// UDACIRACER SIM — CLIENT-SIDE JAVASCRIPT
// ============================================================
// This is the browser-side JavaScript for the UdaciRacer project.
// The Go API (port 3001) owns the race data and race calculations.
// The Express application (port 3002) serves the frontend pages.
// This file communicates with the Go API and updates the browser UI.
//
// Our three project responsibilities are:
//   1. RECEIVE information from the Go API.
//   2. SEND instructions to the Go API.
//   3. DISPLAY information and respond to player interactions.
//
// The comments in this file are intended to explain the concepts,
// the reason for each step, and how the functions work together.
// ============================================================


// PROVIDED CODE BELOW (LINES 1 - 80) DO NOT REMOVE

// ------------------------------------------------------------
// SHARED APPLICATION STATE
// ------------------------------------------------------------
// The store keeps the information that several functions need to
// access while the player moves through the application.
//
// For example:
// - Selecting a track updates track_id and track_name.
// - Selecting a racer updates player_id and player_name.
// - Creating a race updates race_id with the ID returned by the API.
//
// These values begin as undefined because the player has not made
// any selections and no race has been created when the page loads.
let store = {
	track_id: undefined,
	track_name: undefined,
	player_id: undefined,
	player_name: undefined,
	race_id: undefined,
}


// ------------------------------------------------------------
// APPLICATION INITIALIZATION
// ------------------------------------------------------------
// DOMContentLoaded fires after the browser has finished parsing the HTML.
// Waiting for this event means our JavaScript can safely look for HTML
// elements and attach event listeners without running too early.
//
// Once the document is ready, we:
// 1. Load the information needed to populate the track and racer choices.
// 2. Register the click listener that will respond to player actions.
document.addEventListener("DOMContentLoaded", function() {
	onPageLoad()
	setupClickHandlers()
})


// ------------------------------------------------------------
// FUNCTION: onPageLoad()
// PURPOSE: Retrieve the initial track and racer information.
// ------------------------------------------------------------
async function onPageLoad() {
	console.log("Getting form info for dropdowns!")

	try {
		// REQUEST 1: Ask the Go API for the available tracks.
		//
		// getTracks() returns a Promise. When that Promise fulfills,
		// the .then() callback receives the parsed array of track objects.
		// renderTrackCards() converts those objects into HTML cards, and
		// renderAt() inserts that HTML into the existing #tracks element.
		//
		// The .catch() attached to this chain handles a rejected request.
		// getTracks() logs the technical error and rethrows it; this caller
		// decides what to show the player if the request cannot complete.
		getTracks()
			.then(tracks => {
				const html = renderTrackCards(tracks)
				renderAt('#tracks', html)
			})
			.catch(error => {
				console.error("Unable to load the track list:", error)
				renderAt('#tracks', '<li>Unable to load tracks. Please refresh the page.</li>')
			})

		// REQUEST 2: Ask the Go API for the available racers (cars).
		//
		// This request is started independently of the track request.
		// Therefore, both requests can be in progress at the same time.
		// The racer list does not have to wait for the track list to finish.
		//
		// When getRacers() fulfills, its .then() callback receives the
		// parsed racers array. We turn that data into HTML and insert it
		// into the existing #racers element.
		getRacers()
			.then(racers => {
				const html = renderRacerCars(racers)
				renderAt('#racers', html)
			})
			.catch(error => {
				console.error("Unable to load the racer list:", error)
				renderAt('#racers', '<li>Unable to load racers. Please refresh the page.</li>')
			})

	} catch(error) {
		// This try/catch can catch an error thrown immediately while the
		// setup code above is running. It does NOT automatically catch a
		// Promise rejection that occurs later. That is why each independent
		// request has its own .catch() handler attached to its Promise chain.
		console.log("Problem initializing the track and racer requests ::", error.message)
		console.error(error)
	}
}


// ------------------------------------------------------------
// FUNCTION: setupClickHandlers()
// PURPOSE: Listen for player clicks and route each action correctly.
// ------------------------------------------------------------
function setupClickHandlers() {
	// Event delegation: instead of adding a separate click listener to
	// every track card, racer card, and button, we attach one listener to
	// the document. Click events bubble up through the DOM, allowing this
	// one listener to handle clicks on elements created later by rendering.
	document.addEventListener('click', function(event) {
		// A player may click a <span> inside a racer card rather than the
		// outer <h4> element itself. closest() walks up the DOM tree and
		// returns the matching card or button that contains the clicked item.
		const target = event.target instanceof Element
			? event.target.closest('.card.track, .card.racer, #submit-create-race, #gas-peddle')
			: null

		// Ignore clicks that are not on one of the elements we handle.
		if (!target) return

		// PLAYER SELECTS A TRACK
		if (target.matches('.card.track')) {
			handleSelectTrack(target)

			// Store the selected track's ID and visible name.
			// The ID will be sent to the API; the name is used in the UI.
			store.track_id = target.id
			store.track_name = target.textContent.trim()
		}

		// PLAYER SELECTS A RACER
		if (target.matches('.card.racer')) {
			handleSelectRacer(target)

			// The selected racer ID is sent as player_id when the race
			// is created. The name is retained for display purposes.
			store.player_id = target.id
			store.player_name = target.textContent.trim()
		}

		// PLAYER SUBMITS THE CREATE-RACE FORM
		if (target.matches('#submit-create-race')) {
			// Prevent the browser's normal form submission and page reload.
			// JavaScript will control the asynchronous race-creation flow.
			event.preventDefault()
			handleCreateRace()
		}

		// PLAYER PRESSES THE ACCELERATION BUTTON
		if (target.matches('#gas-peddle')) {
			handleAccelerate()
		}

		console.log("Store updated :: ", store)
	}, false)
}


// ------------------------------------------------------------
// FUNCTION: delay(ms)
// PURPOSE: Return a Promise that fulfills after a time delay.
// ------------------------------------------------------------
async function delay(ms) {
	try {
		// setTimeout() schedules its callback to run once after ms milliseconds.
		// Wrapping it in a Promise gives us an operation that can be awaited:
		// await delay(1000) pauses the current async function for one second.
		return await new Promise(resolve => setTimeout(resolve, ms))
	} catch(error) {
		// A normal setTimeout delay is not expected to reject. We still log
		// and rethrow an unexpected error so that the caller can handle it.
		console.error("Problem during delay:", error)
		throw error
	}
}

// ^ PROVIDED CODE ^ DO NOT REMOVE


// ============================================================
// STUDENT IMPLEMENTATION AREA — RACE CONTROL
// ============================================================

// ------------------------------------------------------------
// FUNCTION: handleCreateRace()
// RESPONSIBILITY: Coordinate the sequence required to run a race.
// ------------------------------------------------------------
//
// PURPOSE:
// This is the main coordinator for creating and starting a race.
// It does not perform the API requests itself. Instead, it calls the
// smaller functions responsible for each operation and awaits them
// in the order required by the game.
//
// EXECUTION ORDER:
// 1. Confirm that the player selected a track and a racer.
// 2. Display the race-start screen.
// 3. Ask the API to create the race and receive its race ID.
// 4. Save that ID in the shared store.
// 5. Wait for the countdown to finish.
// 6. Tell the API to start the race.
// 7. Begin monitoring the race until the API reports "finished".
//
// ASYNCHRONOUS BEHAVIOUR:
// This function is async, so it always returns a Promise. Each await
// pauses this function until the relevant Promise fulfills. The browser
// remains free to process other events while the function is waiting.
// ------------------------------------------------------------
async function handleCreateRace() {
	console.log("in create race")

	// The player cannot create a race until both choices have been made.
	// The card IDs are stored as strings by the browser; createRace()
	// converts them into numbers before sending the request to the API.
	if (store.track_id === undefined || store.player_id === undefined) {
		window.alert("Please select both a track and a racer before starting the race.")
		return
	}

	try {
		// STEP 1 — DISPLAY THE RACE-START SCREEN
		//
		// store.track_name is a STRING, not a track object. Therefore,
		// renderRaceStartView() accepts the selected track name directly.
		renderAt('#race', renderRaceStartView(store.track_name))

		// STEP 2 — CREATE THE RACE THROUGH THE GO API
		//
		// We pass the two selected IDs to createRace(). That function sends
		// an HTTP POST request and returns a Promise for the parsed response.
		// await pauses this function until the API response has been parsed.
		const race = await createRace(store.player_id, store.track_id)

		// STEP 3 — SAVE THE NEW RACE ID
		//
		// The create-race endpoint returns an object that includes the race ID.
		// We save it because the start, status and acceleration endpoints
		// all need to know which race they should operate on.
		//
		// IMPORTANT: the property is "ID" in CAPITAL letters, not "id".
		// The Go Race struct has no JSON tags, so Go uses the field name
		// exactly as written. The real response keys are:
		//     ID, Track, PlayerID, Cars, Results
		// (The README says "id", but the live API returns "ID".)
		if (!race || race.ID === undefined || race.ID === null) {
			throw new Error("The create-race response did not contain a race ID.")
		}

		store.race_id = race.ID
		console.log("RACE: ", race)
		console.log("Saved race ID: ", store.race_id)

		// STEP 4 — WAIT FOR THE COUNTDOWN TO FINISH
		//
		// runCountdown() returns a Promise. Because we await it, the next
		// instruction (starting the race) cannot run until the countdown
		// Promise fulfills.
		await runCountdown()

		// STEP 5 — TELL THE GO API TO START THE RACE
		//
		// startRace() sends the POST command. The endpoint returns no body,
		// so its Promise fulfills after we have checked the HTTP status.
		await startRace(store.race_id)

		// The race is now running, so acceleration clicks are allowed.
		// (The button is rendered disabled; see renderRaceStartView().)
		const gasPedal = document.querySelector('#gas-peddle')
		if (gasPedal) {
			gasPedal.disabled = false
		}

		// STEP 6 — MONITOR THE RACE UNTIL IT FINISHES
		//
		// runRace() repeatedly requests the race state. Its Promise fulfills
		// when the API reports status === "finished" and the final results
		// have been rendered. This await keeps the overall workflow connected.
		await runRace(store.race_id)

	} catch(error) {
		// Any failed awaited operation above is converted into an exception
		// at its await point and arrives here. This includes a failed request,
		// a missing race ID, a countdown error, or a race-monitoring error.
		console.error("Unable to create or run the race:", error)

		// Show a visible error to the player rather than leaving the screen
		// without an explanation. textContent treats the error message as
		// plain text instead of interpreting it as HTML.
		const raceScreen = document.querySelector('#race')
		if (raceScreen) {
			const errorMessage = document.createElement('p')
			errorMessage.textContent = `The race could not be completed: ${error.message}`
			errorMessage.setAttribute('role', 'alert')
			raceScreen.appendChild(errorMessage)

			const retryLink = document.createElement('a')
			retryLink.href = '/race'
			retryLink.textContent = 'Return to race setup'
			raceScreen.appendChild(retryLink)
		}
	}
}


// ------------------------------------------------------------
// FUNCTION: runRace(raceID)
// RESPONSIBILITY: Repeatedly receive race state and update the UI.
// ------------------------------------------------------------
//
// PURPOSE:
// The Go API owns the race simulation. The frontend must keep asking
// the API for the latest race state rather than trying to calculate the
// racers' progress on its own.
//
// INPUT:
// raceID is the ID returned by the create-race endpoint and saved in
// store.race_id. It identifies the race we need to monitor.
//
// EXECUTION:
// - setInterval() starts a repeating callback every 500 milliseconds.
// - Each callback calls getRace(raceID), which returns a Promise.
// - While status is "in-progress", the leaderboard is refreshed.
// - When status is "finished", the interval is stopped and the results
//   are displayed. The Promise returned by runRace() is then resolved.
//
// ERROR HANDLING:
// If a status request fails, the interval is stopped and runRace()'s
// Promise is rejected. handleCreateRace() awaits that Promise and catches
// the rejection in its try/catch block.
// ------------------------------------------------------------
function runRace(raceID) {
	return new Promise((resolve, reject) => {
		let raceInterval

		// A request may take longer than 500 milliseconds. This flag prevents
		// a second GET request from starting while the previous one is still
		// in progress. It avoids overlapping requests and out-of-order updates.
		let requestInProgress = false

		raceInterval = setInterval(async () => {
			if (requestInProgress) return

			requestInProgress = true

			try {
				// RECEIVE THE LATEST RACE STATE
				const res = await getRace(raceID)

				// CASE 1 — THE RACE IS IN PROGRESS
				if (res.status === 'in-progress') {
					renderAt('#leaderBoard', raceProgress(res.positions))
				}

				// CASE 2 — THE RACE HAS FINISHED
				else if (res.status === 'finished') {
					// Stop future polling callbacks before resolving the Promise.
					clearInterval(raceInterval)

					// Render the final positions returned by the Go API.
					renderAt('#race', resultsView(res.positions))

					// Tell the caller that race monitoring has completed.
					resolve(res)
				}

				// CASE 3 — THE RACE IS NOT STARTED YET
				//
				// The application normally starts polling after startRace()
				// has fulfilled. If the API briefly reports "unstarted", we
				// simply wait for the next poll rather than inventing a status.
			} catch(error) {
				// A failed asynchronous operation inside a timer callback must
				// be handled here. A surrounding try/catch in the function that
				// created setInterval() cannot catch a later callback rejection.
				clearInterval(raceInterval)
				reject(error)
			} finally {
				requestInProgress = false
			}
		}, 500)
	})
}


// ------------------------------------------------------------
// FUNCTION: runCountdown()
// PURPOSE: Display 3, 2, 1, 0 and resolve when the countdown finishes.
// ------------------------------------------------------------
//
// WHY DOES THIS FUNCTION RETURN A PROMISE?
// The race must not start until the countdown has finished. By returning
// a Promise and resolving it when the timer reaches zero, this function
// allows handleCreateRace() to write:
//
//     await runCountdown()
//
// That makes the order of operations explicit: countdown first, race start
// second. setInterval() performs the repeated timer updates, while the
// Promise communicates when that repeated work has completed.
// ------------------------------------------------------------
async function runCountdown() {
	try {
		// Give the player a short moment to see the initial number 3.
		await delay(1000)

		let timer = 3

		return await new Promise((resolve, reject) => {
			const countdownDisplay = document.getElementById('big-numbers')

			// If the race-start view was not rendered correctly, there is no
			// element to update. Reject the Promise so the caller can respond.
			if (!countdownDisplay) {
				reject(new Error('The countdown display element was not found.'))
				return
			}

			const countdownInterval = setInterval(() => {
				// Decrease the number by one and display the updated value.
				timer -= 1
				countdownDisplay.textContent = timer

				// Once the number reaches zero, stop the interval and resolve.
				if (timer <= 0) {
					clearInterval(countdownInterval)
					resolve()
				}
			}, 1000)
		})

	} catch(error) {
		console.error("Problem during the race countdown:", error)
		// Rethrowing keeps the failure visible to handleCreateRace().
		throw error
	}
}


// ------------------------------------------------------------
// FUNCTION: handleSelectRacer(target)
// PURPOSE: Visually mark the chosen racer card as selected.
// ------------------------------------------------------------
function handleSelectRacer(target) {
	console.log("selected a racer", target.id)

	// Remove the selected class from the previously selected racer, if any.
	const selected = document.querySelector('#racers .selected')
	if (selected) {
		selected.classList.remove('selected')
	}

	// Add the selected class to the card that was just clicked.
	target.classList.add('selected')
}


// ------------------------------------------------------------
// FUNCTION: handleSelectTrack(target)
// PURPOSE: Visually mark the chosen track card as selected.
// ------------------------------------------------------------
function handleSelectTrack(target) {
	console.log("selected track", target.id)

	// Remove the selected class from the previously selected track, if any.
	const selected = document.querySelector('#tracks .selected')
	if (selected) {
		selected.classList.remove('selected')
	}

	// Add the selected class to the card that was just clicked.
	target.classList.add('selected')
}


// ------------------------------------------------------------
// FUNCTION: handleAccelerate()
// PURPOSE: Send an acceleration command for the current race.
// ------------------------------------------------------------
async function handleAccelerate() {
	console.log("accelerate button clicked")

	// The acceleration endpoint needs the ID of the race currently underway.
	if (store.race_id === undefined || store.race_id === null) {
		console.warn("Cannot accelerate because no race ID is stored yet.")
		return
	}

	try {
		// Each click sends a POST request to the Go API. The API updates the
		// race simulation; the next 500 ms polling cycle retrieves the new state.
		await accelerate(store.race_id)
	} catch(error) {
		console.error("The acceleration request failed:", error)

		const button = document.querySelector('#gas-peddle')
		if (button) {
			button.textContent = 'Acceleration failed — click to try again'
		}
	}
}


// ============================================================
// HTML VIEWS — DISPLAY INFORMATION IN THE BROWSER
// ============================================================
// These functions do not send API requests. They receive JavaScript data
// and convert it into HTML strings. renderAt() inserts those strings into
// the appropriate element in the DOM.
// ============================================================

function renderRacerCars(racers) {
	if (!Array.isArray(racers) || racers.length === 0) {
		return '<li>No racers are currently available.</li>'
	}

	// map() calls renderRacerCard() once for each racer and creates an array
	// of HTML strings. join('') combines those strings into one HTML fragment.
	// The existing #racers <ul> is the container, so we return only its items;
	// we must not create another nested <ul> with the same ID.
	return racers.map(renderRacerCard).join('')
}


function renderRacerCard(racer) {
	const { id, driver_name, top_speed, acceleration, handling } = racer

	// The project provides useful performance information for each car.
	// Displaying it lets the player compare the racers before making a choice.
	// The <span> elements remain inside the clickable card; setupClickHandlers()
	// uses closest() so a click on one of these spans still selects the card.
	return `
		<li>
			<h4 class="card racer" id="${id}">
				${driver_name}<br>
				<span>Top speed: ${top_speed}</span><br>
				<span>Acceleration: ${acceleration}</span><br>
				<span>Handling: ${handling}</span>
			</h4>
		</li>
	`
}


function renderTrackCards(tracks) {
	if (!Array.isArray(tracks) || tracks.length === 0) {
		return '<li>No tracks are currently available.</li>'
	}

	// The existing #tracks element in race.html is already a <ul>.
	// Return its list items rather than generating a second nested <ul>.
	return tracks.map(renderTrackCard).join('')
}


function renderTrackCard(track) {
	const { id, name } = track

	return `
		<li>
			<h4 id="${id}" class="card track">${name}</h4>
		</li>
	`
}


function renderCountdown(count) {
	return `
		<h2>Race Starts In...</h2>
		<p id="big-numbers">${count}</p>
	`
}


function renderRaceStartView(trackName) {
	// trackName is a string taken from store.track_name. The old version
	// expected an object and tried to read track.name, which produced
	// "undefined" because the click handler stores only the name string.
	return `
		<header>
			<h1>Race: ${trackName}</h1>
		</header>
		<main id="two-columns">
			<section id="leaderBoard">
				${renderCountdown(3)}
			</section>

			<section id="accelerate">
				<h2>Directions</h2>
				<p>Click the button as fast as you can to make your racer go faster!</p>
				<!--
					The button starts DISABLED. Before the race starts, the Go API
					has nothing listening for acceleration commands, so each click
					would leave a request hanging. Browsers allow only about six
					open connections to one server, so enough early clicks would
					block the startRace() request itself. handleCreateRace()
					enables the button after startRace() succeeds.
				-->
				<button id="gas-peddle" disabled>Click Me To Win!</button>
			</section>
		</main>
		<footer></footer>
	`
}


function resultsView(positions) {
	// The README documents each position as { car: {...}, final_position, ... },
	// but the live Go API returns the car fields FLATTENED into the position:
	// { id, driver_name, top_speed, acceleration, handling, speed, segment,
	//   final_position }. (Go "embeds" the Car struct inside CarPosition,
	// and embedded struct fields are written at the same level in JSON.)
	// We therefore read id and driver_name directly from each position.
	const playerId = Number.parseInt(store.player_id, 10)

	// Create a copy before sorting so we do not mutate the array supplied
	// by the API. final_position is the official finishing rank.
	const orderedPositions = [...positions].sort((a, b) => {
		return a.final_position - b.final_position
	})

	const rows = orderedPositions.map((position, index) => {
		const isPlayer = position.id === playerId
		const displayedName = isPlayer ? `${position.driver_name} (you)` : position.driver_name
		const finishingPosition = position.final_position ?? index + 1

		return `
			<tr>
				<td>${finishingPosition}</td>
				<td>${displayedName}</td>
			</tr>
		`
	}).join('')

	return `
		<header>
			<h1>Race Results</h1>
		</header>
		<main>
			<h2>Final Race Results</h2>
			<p>The race is done! Here are the final rankings:</p>
			<table>
				<thead>
					<tr>
						<th>Position</th>
						<th>Racer</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
			<a href="/race">Start a new race</a>
		</main>
		<footer></footer>
	`
}


function raceProgress(positions) {
	const playerId = Number.parseInt(store.player_id, 10)

	// During the race, the segment field indicates how far a car has moved.
	// Sort a copied array from the greatest segment to the smallest segment.
	// The Go API remains the source of truth for these values.
	const orderedPositions = [...positions].sort((a, b) => {
		if (b.segment !== a.segment) {
			return b.segment - a.segment
		}

		// If two cars are on the same segment, use speed as a secondary
		// display ordering. This does not change the race simulation itself.
		return b.speed - a.speed
	})

	const rows = orderedPositions.map((position, index) => {
		const isPlayer = position.id === playerId
		const displayedName = isPlayer ? `${position.driver_name} (you)` : position.driver_name

		return `
			<tr>
				<td>${index + 1}</td>
				<td>${displayedName}</td>
				<td>${position.segment}</td>
			</tr>
		`
	}).join('')

	return `
		<h2>Race Progress</h2>
		<table>
			<thead>
				<tr>
					<th>Position</th>
					<th>Racer</th>
					<th>Segment</th>
				</tr>
			</thead>
			<tbody>
				${rows}
			</tbody>
		</table>
	`
}


// ------------------------------------------------------------
// FUNCTION: renderAt(element, html)
// PURPOSE: Insert generated HTML into an existing DOM element.
// ------------------------------------------------------------
function renderAt(element, html) {
	const node = document.querySelector(element)

	// A missing target should be reported clearly instead of causing an
	// unclear "Cannot set properties of null" error at innerHTML below.
	if (!node) {
		console.error(`Cannot render because the element ${element} was not found.`)
		return
	}

	node.innerHTML = html
}


// ============================================================
// API CALLS — COMMUNICATION WITH THE GO API
// ============================================================

const SERVER = 'http://localhost:3001'


// ------------------------------------------------------------
// FUNCTION: defaultFetchOpts()
// PURPOSE: Return Fetch options shared by our API requests.
// ------------------------------------------------------------
function defaultFetchOpts() {
	return {
		mode: 'cors',
		headers: {
			'Content-Type': 'application/json',

			// CORS NOTE:
			// Access-Control-Allow-Origin is normally a RESPONSE header
			// supplied by the server, not a request header supplied by the
			// browser. This line comes from the starter configuration and is
			// kept unchanged. It is harmless: the Go API's CORS settings
			// (AllowedHeaders in api/server.go) explicitly accept this header,
			// and full races were tested with the frontend on port 3002
			// calling the API on port 3001 without any CORS errors.
			'Access-Control-Allow-Origin' : SERVER,
		},
	}
}


// ============================================================
// IMPORTANT JAVASCRIPT CONCEPT:
// PROMISE CHAINING vs ASYNC/AWAIT
// ============================================================
//
// JavaScript provides two common ways to work with asynchronous
// operations. Both approaches are built on the same underlying
// mechanism: Promises. They are not two separate asynchronous systems.
//
// 1. PROMISE CHAINING — .then() and .catch()
//
//    .then() attaches a callback that runs when the preceding Promise
//    fulfills. The callback can use the value produced by that Promise.
//
//    .catch() attaches a callback that runs when a preceding Promise
//    in the chain is rejected, or when an error is thrown in an earlier
//    Promise callback.
//
//    We connect these handlers to create a Promise chain. Returning a
//    value from a .then() callback passes that value to the next .then().
//    Returning another Promise makes the chain wait for that Promise to
//    settle before the next stage receives its result.
//
// 2. ASYNC/AWAIT — async, await, try and catch
//
//    async/await is another, often more readable, way to work with
//    Promises. An async function always returns a Promise.
//
//    await pauses the execution of the CURRENT async function until
//    the awaited Promise settles. If it fulfills, await gives us its
//    fulfilled value. If it rejects, await throws the rejection as an
//    error, which can be handled by a surrounding try/catch block.
//
//    IMPORTANT: await does NOT freeze the browser or stop all other
//    JavaScript from running. It pauses only the current async function
//    while the browser can continue other work.
//
// 3. TRY/CATCH DOES NOT AUTOMATICALLY HANDLE EVERY PROMISE REJECTION
//
//    A try/catch block catches errors thrown while its try block is
//    executing. If we start a Promise but do not await it, a rejection
//    that occurs later will not be caught by that surrounding try/catch.
//    In that situation, attach .catch() to the Promise or await it inside
//    the try block of an async function.
//
// WHY ARE WE USING BOTH APPROACHES IN UDACIRACER?
//
//    We use .then() and .catch() in our API helper functions so that we
//    can study Promise chaining, fulfillment, rejection and propagation.
//
//    We use async/await in the application's main execution flow, where
//    one asynchronous operation must finish before the next dependent
//    operation begins: create the race, wait for the countdown, start
//    the race, and then monitor its progress.
//
// REMEMBER:
//    async/await does NOT replace Promises. It provides another syntax
//    for working with Promises.
// ============================================================


// ============================================================
// IMPORTANT JAVASCRIPT CONCEPT:
// LOGGING AN ERROR vs PROPAGATING AN ERROR
// ============================================================
//
// These are two different operations and they have different purposes.
//
// 1. LOGGING AN ERROR — console.error(error)
//
//    console.error() displays error information in the browser's
//    developer console. This helps us, as developers, see and diagnose
//    what went wrong.
//
//    IMPORTANT: logging an error does NOT reject a Promise, rethrow an
//    error, or automatically notify the function that called us. It
//    reports the problem; it does not pass the failure onwards.
//
// 2. PROPAGATING AN ERROR — throw error
//
//    throw error rethrows the SAME error object that the current catch
//    callback received. It does not create a new error object.
//
//    When an error is thrown inside a .catch() callback, the Promise
//    returned by that .catch() becomes rejected again. The rejection
//    can then travel to the next caller or error handler in the chain.
//
// 3. WHY MIGHT WE USE BOTH?
//
//    We may use console.error() to REPORT the problem to the developer,
//    and throw error to COMMUNICATE the failure to the calling function.
//
//    If a .catch() callback only logs the error and returns normally,
//    the Promise returned by that .catch() becomes fulfilled with
//    undefined (unless the callback returns another value or Promise).
//    In that case, the original rejection has been handled and is no
//    longer rejected further down the chain.
//
//    By throwing the error again, we keep the Promise rejected so that
//    the caller can decide how the application should respond.
//
// REMEMBER:
//    LOGGING     = reporting that something went wrong.
//    PROPAGATING = passing the failure to another function or handler.
//
//    Logging an error is NOT the same as propagating an error.
// ============================================================


// ============================================================
// FUNCTION: getTracks()
// RESPONSIBILITY: RECEIVE INFORMATION FROM THE GO API
// ============================================================
//
// PURPOSE:
// Request the list of racing tracks that the player can choose from.
//
// HTTP REQUEST:
// Method:   GET
// Endpoint: http://localhost:3001/api/tracks
//
// EXPECTED RESULT:
// This function returns a Promise that ultimately fulfills with an
// array of JavaScript track objects after the response body is parsed.
// ============================================================
function getTracks() {
	// Display the endpoint in the browser console. During development,
	// this helps us confirm which API endpoint the function is calling.
	console.log(`calling server :: ${SERVER}/api/tracks`)

	// STEP 1 — SEND THE HTTP REQUEST: fetch()
	//
	// fetch() initiates an HTTP request to the supplied URL. Because we
	// have not specified another method, fetch() uses HTTP GET by default.
	// GET is appropriate because we are asking the API to provide data;
	// we are not creating or modifying a race in this function.
	//
	// fetch() returns a Promise immediately. The Promise represents the
	// future HTTP response; it is not the track array itself.
	//
	// MESSENGER ANALOGY:
	// Imagine sending a messenger to a restaurant to ask for information.
	// fetch() is like sending the messenger. The messenger has to travel
	// to the restaurant and return, so we cannot use the response right
	// away. The Promise represents this wait for the HTTP response.
	//
	// We use return so that the calling function (onPageLoad()) receives
	// the Promise and can attach its own .then() and .catch() handlers.
	return fetch(`${SERVER}/api/tracks`)

		// STEP 2 — RECEIVE THE HTTP RESPONSE: .then()
		//
		// This .then() is part of a PROMISE CHAIN. It attaches a callback
		// to the Promise returned by fetch(). The callback runs when that
		// Promise fulfills, and its 'response' parameter receives the
		// browser's Response object.
		//
		// The Response object is like the sealed envelope brought back
		// by our messenger. It contains HTTP response information (such
		// as the status code) and provides access to the response body.
		// It is not yet the parsed array of track objects.
		//
		// IMPORTANT: a fulfilled fetch Promise does not always mean that
		// the HTTP request was successful. The server can respond with
		// an HTTP error status such as 404 or 500, and fetch() normally
		// still fulfills with a Response object. We must inspect response.ok.
		.then(response => {
			// STEP 2A — CHECK THE HTTP STATUS: response.ok
			//
			// response.ok is a Boolean property of the Response object.
			// It is true for HTTP status codes in the 200–299 range and
			// false for other status codes.
			//
			// The exclamation mark (!) is JavaScript's logical NOT operator.
			// It reverses a Boolean value. Therefore, !response.ok means
			// "the HTTP response is NOT successful".
			if (!response.ok) {
				// fetch() does not automatically reject for HTTP statuses
				// such as 404 or 500. Throwing an Error inside this .then()
				// makes this Promise chain reject and sends the error to .catch().
				throw new Error(`HTTP error! Status: ${response.status}`)
			}

			// STEP 3 — READ AND PARSE THE RESPONSE BODY: response.json()
			//
			// We reach this line only when response.ok is true.
			// response.json() reads the response body and parses its JSON
			// text into usable JavaScript data. For this endpoint, we
			// expect that data to be an array of track objects.
			//
			// MESSENGER ANALOGY — OPENING AND READING THE ENVELOPE:
			// fetch() brought back the envelope (the Response object).
			// response.json() is like the person who opens the envelope,
			// reads the document inside, and makes sense of its contents.
			//
			// WHY DOES response.json() ALSO RETURN A PROMISE?
			// The server does NOT send us a Promise inside the response.
			// The browser's Response API creates and returns this second
			// Promise when we call response.json(). Reading the response
			// body and parsing its JSON is asynchronous, so the parsed
			// JavaScript data is not available immediately.
			//
			// In Promise terms:
			//   fetch(url)         returns Promise<Response>
			//   response.json()   returns Promise<parsed data>
			//
			// Returning this second Promise connects it to the current
			// Promise chain. The chain waits for parsing to finish, and
			// the next .then() receives the parsed track array.
			//
			// ALSO REMEMBER:
			// response.json() only parses the data. It does NOT decide
			// where the information appears on the webpage. Rendering is
			// a separate responsibility handled later by renderTrackCards()
			// and renderAt().
			return response.json()
		})

		// STEP 4 — HANDLE REJECTIONS: .catch()
		//
		// This .catch() can receive a rejection from an earlier stage:
		// 1. A network or connection failure from fetch().
		// 2. An HTTP error that we explicitly created with throw new Error().
		// 3. A JSON parsing failure from response.json().
		//
		// console.error() reports the problem in the developer console.
		// throw error rethrows the same Error object so onPageLoad(), the
		// caller, can decide how the application should respond.
		.catch(error => {
			console.error("Problem retrieving tracks from the Go API:", error)
			throw error
		})
}


// ============================================================
// FUNCTION: getRacers()
// RESPONSIBILITY: RECEIVE INFORMATION FROM THE GO API
// ============================================================
//
// PURPOSE:
// Request the list of available cars/racers from the Go API.
//
// EXPECTED RESULT:
// A Promise that ultimately fulfills with the parsed racers array.
// ============================================================
function getRacers() {
	console.log(`calling server :: ${SERVER}/api/cars`)

	// fetch() defaults to GET, which is appropriate because this function
	// retrieves the existing list of cars without changing anything.
	return fetch(`${SERVER}/api/cars`)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`)
			}

			// IMPORTANT: response.json() reads the response body and parses
			// its JSON content into JavaScript data. This operation is
			// asynchronous, so response.json() returns a Promise rather than
			// giving us the parsed data immediately.
			//
			// We MUST return this Promise so that the current .then() becomes
			// connected to the JSON-parsing operation. The Promise chain will
			// wait for parsing to finish and then pass the resulting
			// JavaScript data (our racers array) to the next .then().
			//
			// Without return, the current .then() would finish with undefined,
			// and the next .then() would not receive the parsed racers array.
			//
			// In our application, the next .then(racers => ...) receives
			// the parsed racers array, rather than the original Fetch
			// Response object.
			//
			// The next steps are separate responsibilities:
			//
			// 1. renderRacerCars(racers) receives the parsed racers array
			//    and converts the racer data into HTML.
			//
			// 2. renderAt('#racers', html) inserts that generated HTML
			//    into the appropriate location in the webpage's DOM.
			//
			// REMEMBER: Parsing data and displaying data are two separate
			// operations. This function retrieves and parses the racers;
			// rendering them on the webpage is handled separately.
			return response.json()
		})
		.catch(error => {
			// Log the error so that we can identify the problem while debugging.
			console.error("Problem retrieving racers from the Go API:", error)

			// Propagate the same error to the calling function. Rethrowing
			// ensures that this Promise remains rejected, allowing the caller
			// to handle the failure rather than silently receiving undefined.
			throw error
		})
}


// ============================================================
// FUNCTION: createRace(player_id, track_id)
// RESPONSIBILITY: SEND INFORMATION TO THE GO API
// ============================================================
//
// PURPOSE:
// Ask the Go API to create a new race using the racer and track selected
// by the player. The API responds with a race object that includes an ID.
// That ID is needed by the start, status and acceleration requests.
//
// HTTP REQUEST:
// Method: POST
// Endpoint: http://localhost:3001/api/races
// Body: { player_id: number, track_id: number }
//
// RETURN VALUE:
// This function returns a Promise that ultimately fulfills with the
// parsed race object returned by the Go API.
// ============================================================
function createRace(player_id, track_id) {
	// The selected card IDs come from HTML id attributes, so they arrive
	// as strings. The API expects numeric IDs; convert them before sending.
	player_id = Number.parseInt(player_id, 10)
	track_id = Number.parseInt(track_id, 10)

	// Do not send a request containing NaN. Returning a rejected Promise
	// keeps the function's asynchronous contract consistent for its caller.
	if (!Number.isInteger(player_id) || !Number.isInteger(track_id)) {
		return Promise.reject(new Error('A valid racer ID and track ID are required.'))
	}

	// STEP 1 — PREPARE THE DATA TO SEND TO THE GO API
	//
	// The body variable is a JavaScript object containing the IDs of the
	// racer and track selected by the player. For example:
	//
	//     { player_id: 3, track_id: 2 }
	//
	// This object contains the information the Go API needs to create a race.
	const body = { player_id, track_id }

	// STEP 2 — SEND AN HTTP POST REQUEST
	//
	// We use POST because we are instructing the Go API to create a new race
	// rather than simply retrieve existing information.
	return fetch(`${SERVER}/api/races`, {
		method: 'POST',

		// REUSING COMMON FETCH OPTIONS — OBJECT SPREAD SYNTAX
		//
		// defaultFetchOpts() is a helper function that returns a JavaScript
		// object containing commonly used Fetch configuration options.
		//
		// The three dots (...) are the object spread syntax. They copy the
		// properties of the object returned by defaultFetchOpts() into this
		// Fetch options object.
		//
		// This avoids manually repeating common configuration settings in
		// every API request. The returned object contains mode and headers.
		//
		// IMPORTANT: the spread syntax does not send the request. It simply
		// combines object properties. fetch() initiates the HTTP request.
		...defaultFetchOpts(),

		// STEP 3 — SERIALIZE THE JAVASCRIPT OBJECT: JSON.stringify()
		//
		// JSON.stringify() converts (serializes) a JavaScript value, such as
		// an object, into a JSON-formatted string.
		//
		// For example:
		//     { player_id: 3, track_id: 2 }
		// becomes:
		//     '{"player_id":3,"track_id":2}'
		//
		// Fetch does not automatically serialize a plain JavaScript object
		// into JSON when it is used as the request body. We explicitly
		// convert the object into JSON text before passing it to fetch().
		//
		// The resulting JSON string is placed in the HTTP request body so
		// that the Go API can read the selected racer and track IDs.
		//
		// IMPORTANT:
		// JSON.stringify() prepares the JSON string;
		// fetch() transmits that string to the Go API.
		//
		// DATA FLOW:
		// JavaScript object -> JSON.stringify() -> JSON text -> fetch()
		// -> HTTP POST request -> Go API
		body: JSON.stringify(body)
	})
		.then(response => {
			// UNDERSTANDING WHAT .catch() ACTUALLY INTERCEPTS:
			//
			// A .catch() handler handles REJECTED Promises. It does not
			// automatically intercept every HTTP response that indicates
			// a problem.
			//
			// A network failure can reject fetch(). JSON parsing can also
			// reject if the response body cannot be read or parsed. In
			// addition, throwing an error inside this .then() converts the
			// returned Promise into a rejected Promise.
			//
			// WHY DOES A 404 OR 500 NOT AUTOMATICALLY REACH .catch()?
			// The server has responded, so fetch() normally fulfills with
			// a Response object even when the status is 404 or 500. We must
			// inspect response.ok and explicitly throw an error ourselves.
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`)
			}

			// The create-race endpoint returns a JSON race object. Returning
			// response.json() connects the body-parsing Promise to this chain.
			// The caller's await createRace(...) will therefore receive the
			// parsed object, including its race ID, not the Response envelope.
			return response.json()
		})
		.catch(error => {
			console.error("Problem creating race:", error)

			// Propagate the same error to the calling function.
			throw error
		})
}


// ============================================================
// FUNCTION: getRace(id)
// RESPONSIBILITY: RECEIVE THE CURRENT STATE OF A RACE
// ============================================================
//
// PURPOSE:
// Retrieve the current race information for one particular race.
// runRace() calls this function repeatedly while the race is underway.
//
// HTTP REQUEST:
// Method: GET
// Endpoint: http://localhost:3001/api/races/{id}
//
// EXPECTED RESULT:
// A parsed race object containing a status and a positions array.
// Each positions entry contains the car's fields (id, driver_name, ...)
// directly, plus race data such as segment, speed and (when available)
// final_position. There is no nested "car" object in the live response.
// ============================================================
function getRace(id) {
	console.log(`calling server :: ${SERVER}/api/races/${id}`)

	return fetch(`${SERVER}/api/races/${id}`)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`)
			}

			// The GET race endpoint returns JSON. Return the Promise from
			// response.json() so the caller receives the parsed race object.
			return response.json()
		})
		.catch(error => {
			console.error("Problem retrieving race information:", error)
			throw error
		})
}


// ============================================================
// FUNCTION: startRace(id)
// RESPONSIBILITY: SEND THE COMMAND TO BEGIN A RACE
// ============================================================
//
// HTTP REQUEST:
// Method: POST
// Endpoint: http://localhost:3001/api/races/{id}/start
//
// IMPORTANT API DETAIL:
// The project documentation says this endpoint returns nothing. We check
// the HTTP status, but we do NOT call response.json() on an empty body.
// Trying to parse an empty response body as JSON would cause a parsing error
// even if the server successfully started the race.
// ============================================================
function startRace(id) {
	return fetch(`${SERVER}/api/races/${id}/start`, {
		method: 'POST',
		...defaultFetchOpts(),
	})
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`)
			}

			// No response.json() here: the API endpoint has no response body.
			// Reaching the end of this callback means the request succeeded.
		})
		.catch(error => {
			console.error("Problem starting race:", error)
			throw error
		})
}


// ============================================================
// FUNCTION: accelerate(id)
// RESPONSIBILITY: SEND AN ACCELERATION COMMAND TO THE GO API
// ============================================================
//
// HTTP REQUEST:
// Method: POST
// Endpoint: http://localhost:3001/api/races/{id}/accelerate
// Body: none
//
// The API documentation says that this endpoint returns nothing. We check
// the HTTP status and do not attempt to parse an empty response body.
// ============================================================
function accelerate(id) {
	return fetch(`${SERVER}/api/races/${id}/accelerate`, {
		method: 'POST',
		...defaultFetchOpts(),
	})
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`)
			}

			// No response.json() here: the accelerate endpoint returns no body.
		})
		.catch(error => {
			console.error("Problem sending the acceleration command:", error)
			throw error
		})
}