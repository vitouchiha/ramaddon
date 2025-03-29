import pkg from 'stremio-addon-sdk';
import seriesCatalog from './rama_series.js';
import { getMeta, getEpisodes } from './episodes.js';

const { addonBuilder, serveHTTP } = pkg;

const META_CACHE_TTL = 600000;

const manifest = {
    "id": "community.ramaorientalfansub",
    "version": "1.0.6",
    "name": "Rama Oriental Fansub +",
    "description": "Addon migliorato con scraper avanzato",
    "catalogs": [{
        "type": "kdrama",
        "id": "rama_series",
        "name": "Serie Coreane",
        "extra": [
            { "name": "search", "isRequired": false },
            { "name": "skip", "isRequired": false }
        ]
    }],
    "resources": ["catalog", "meta", "stream"],
    "types": ["series"],
    "logo": "https://i.imgur.com/i7VdVv7.png",
    "background": "https://i.imgur.com/mtsxMk7.jpeg"
};

const builder = new addonBuilder(manifest);
const metaCache = new Map();

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        if (type !== "series") return { streams: [] };
        let meta = metaCache.get(id);
        if (!meta) {
            const metaResult = await getMeta(id);
            if (metaResult && metaResult.meta) {
                meta = metaResult.meta;
                metaCache.set(id, meta);
            } else {
                console.warn(`Nessun metadato trovato per ${id}`);
                return { streams: [] };
            }
        }

        if (!meta.episodes) {
            console.log(`Caricamento episodi per ${id}`);
            const episodes = await getEpisodes(meta.seriesLink, $);
            meta.episodes = episodes
            metaCache.set(id, meta); // Aggiorna la cache con gli episodi
        }

        if (meta.episodes) {
            return {
                streams: meta.episodes?.flatMap(ep =>
                    ep.streams.map(stream => ({
                        title: `${ep.title} - ${stream.title}`,
                        url: stream.url,
                        type: "video/mp4",
                        behaviorHints: { bingeGroup: id }
                    }))
                )
            };
        } else {
            console.warn(`Nessun episodio trovato per ${id}`);
            return { streams: [] };
        }
    } catch (error) {
        console.error(`Handler Error: ${error.message}`);
        return { streams: [] };
    }
});

builder.defineCatalogHandler(async (args) => {
    if (args.type === 'kdrama' && args.id === 'rama_series') {
        return seriesCatalog(args);
    }
    return { metas: [] };
});

builder.defineMetaHandler(async (args) => {
    let meta = metaCache.get(args.id);
    if (!meta) {
        try {
            const metaResult = await getMeta(args.id);
            if (metaResult && metaResult.meta) {
                meta = metaResult.meta;
                metaCache.set(args.id, meta);
            } else {
                console.warn(`Nessun metadato trovato per ${args.id}`);
                return { meta: null };
            }
        } catch (error) {
            console.error(`Errore nel caricamento dei metadati per ${args.id}:`, error);
            return { meta: null };
        }
    }
    return { meta: { ...meta, extra: meta.extra } };
});

serveHTTP(builder.getInterface(), { port: 7000 });
console.log(`Addon server is running at http://localhost:7000/manifest.json`);
