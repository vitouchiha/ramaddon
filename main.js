import pkg from 'stremio-addon-sdk';
import seriesCatalog from './rama_series.js';
import { getMeta } from './episodes.js';

const { addonBuilder, serveHTTP } = pkg;

const META_CACHE_TTL = 600000;

const manifest = {
    "id": "community.ramaorientalfansub",
    "version": "1.0.6",
    "name": "Rama Oriental Fansub +",
    "description": "Addon migliorato con scraper avanzato",
    "catalogs": [
        {
            "type": "series",
            "id": "rama_series",
            "name": "Serie Coreane",
            "extra": [{ "name": "skip" }]
        }
    ],
    "resources": ["catalog", "meta", "stream"],
    "types": ["series"],
    "logo": "https://imgur.com/a/490DfJR",
    "background": "https://imgur.com/a/tw9s9Im"
};

const builder = new addonBuilder(manifest);
const metaCache = new Map();

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        if (type !== "series") return { streams: [] };
        let meta = metaCache.get(id);
        if (!meta) {
            const metaResult = await getMeta(id);
            meta = metaResult.meta;
            metaCache.set(id, meta);

            // Carica gli episodi solo se non sono già stati caricati
            if (!meta.episodes) {
                console.log(`Caricamento episodi per ${id}`);
                meta.episodes = await getEpisodes(meta.seriesLink, meta.baseId);
                metaCache.set(id, meta); // Aggiorna la cache con gli episodi
            }
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
    console.log("Catalog Handler chiamato con:", args); // Aggiungi questo log
    if (args.type === 'series' && args.id === 'rama_series') {
        return seriesCatalog(args);
    }
    return { metas: [] }; // Aggiungi un return di default
});

builder.defineMetaHandler(async (args) => {
    let meta = metaCache.get(args.id);
    if (!meta) {
        try {
            const metaResult = await getMeta(args.id);
            meta = metaResult.meta;
            metaCache.set(args.id, meta);
        } catch (error) {
            console.error(`Errore nel caricamento dei metadati per ${args.id}:`, error);
            return { meta: null };
        }
    }
    return { meta: { ...meta, extra: meta.extra } };
});

serveHTTP(builder.getInterface(), { port: 7000 });
console.log(`Addon server is running at http://localhost:7000/manifest.json`);
