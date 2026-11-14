// Sample NASA responses, shaped like the real APIs, used by the tests and the mock server.

const img = (n) => `/mock-img/${n}.svg`

const apod = {
    title: 'Lighthouse and Milky Way',
    date: '2026-10-31',
    media_type: 'image',
    url: img('apod'),
    hdurl: img('apod'),
    explanation: 'Gaps in light from a lighthouse line up with dust lanes of our Milky Way Galaxy.',
    copyright: '\nMauricio Salazar\n',
}

const legacyLatest = {
    latest_photos: [
        {
            id: 1,
            sol: 4102,
            camera: { name: 'NAVCAM', full_name: 'Navigation Camera' },
            img_src: 'http://mars.nasa.gov/a.jpg',
            earth_date: '2024-02-19',
            rover: { name: 'Curiosity', landing_date: '2012-08-06', launch_date: '2011-11-26', status: 'active', max_sol: 4102, total_photos: 695000 },
        },
        {
            id: 2,
            sol: 4102,
            camera: { name: 'MAST', full_name: 'Mast Camera' },
            img_src: 'http://mars.nasa.gov/b.jpg',
            earth_date: '2024-02-19',
            rover: { name: 'Curiosity' },
        },
    ],
}

const rawFeed = {
    items: Array.from({ length: 14 }, (_, i) => ({
        id: 9000 + i,
        sol: i < 10 ? 4710 : 4709,
        instrument: ['NAV_LEFT_B', 'MAST_LEFT', 'FHAZ_RIGHT_B', 'CHEMCAM_RMI'][i % 4],
        title: `Sol ${i < 10 ? 4710 : 4709}: Raw image ${i}`,
        date_taken: `2026-10-${i < 10 ? '29' : '28'}T1${i % 10}:00:00.000Z`,
        image_files: { medium: img(i), small: img(i), full_res: img(i) },
    })),
}

const library = (rover) => ({
    collection: {
        items: [
            ...Array.from({ length: 10 }, (_, i) => ({
                data: [
                    {
                        nasa_id: `${rover}-${i}`,
                        title: `${rover} rover view ${i}`,
                        description: `Image taken by NASA's ${rover} rover on Mars.`,
                        center: 'JPL',
                        date_created: `${2010 - Math.floor(i / 3)}-0${(i % 9) + 1}-15T00:00:00Z`,
                    },
                ],
                links: [{ href: img(20 + i), rel: 'preview' }],
            })),
            {
                data: [{ nasa_id: 'unrelated', title: 'Jupiter storm', description: 'Juno image', date_created: '2025-01-01T00:00:00Z' }],
                links: [{ href: img(99), rel: 'preview' }],
            },
        ],
    },
})

module.exports = { apod, legacyLatest, rawFeed, library }
