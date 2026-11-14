// ------------------------------------------------------  ROVER FACTS
// Static mission facts for each rover. These are the fallback values used when
// the (now archived) NASA Mars Rover Photos manifest is unavailable.
// Everything is frozen so no function can mutate it.

const deepFreeze = (obj) =>
    Object.freeze(
        Object.keys(obj).reduce(
            (acc, key) => ({
                ...acc,
                [key]: obj[key] !== null && typeof obj[key] === 'object' ? deepFreeze(obj[key]) : obj[key],
            }),
            {}
        )
    )

const ROVERS = deepFreeze({
    curiosity: {
        name: 'Curiosity',
        mission: 'Mars Science Laboratory',
        launchDate: '2011-11-26',
        landingDate: '2012-08-06',
        status: 'active',
        missionEnd: null,
        landingSite: 'Gale Crater',
        rawImageMission: 'msl',
    },
    opportunity: {
        name: 'Opportunity',
        mission: 'Mars Exploration Rover B',
        launchDate: '2003-07-07',
        landingDate: '2004-01-25',
        status: 'complete',
        missionEnd: '2019-02-13',
        landingSite: 'Meridiani Planum',
        rawImageMission: null,
    },
    spirit: {
        name: 'Spirit',
        mission: 'Mars Exploration Rover A',
        launchDate: '2003-06-10',
        landingDate: '2004-01-04',
        status: 'complete',
        missionEnd: '2011-05-25',
        landingSite: 'Gusev Crater',
        rawImageMission: null,
    },
})

const ROVER_NAMES = Object.freeze(Object.values(ROVERS).map((rover) => rover.name))

module.exports = { ROVERS, ROVER_NAMES, deepFreeze }
