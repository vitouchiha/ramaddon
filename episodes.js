// episodes.js
import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';
import { getStream } from './streams.js';

const metaCache = new Map();

async function fetchWithCloudscraper(url, retries = 2) {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        'Mozilla/5.0 (Linux; Android 14; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.140 Mobile Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/123.0.6312.122'
    ];

    function getRandomHeaders() {
        return {
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
            'Referer': 'https://ramaorientalfansub.tv',
            'Accept-Language': 'en-US,en;q=0.9',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive'
        };
    }

    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[${i + 1}/${retries}] Tentativo di scraping: ${url}`);
            const response = await cloudscraper.get({
                uri: url,
                headers: getRandomHeaders(),
                followAllRedirects: true,
                maxRedirects: 2,
                timeout: 10000,
                resolveWithFullResponse: true // Aggiungi questa opzione
            });

            // Gestione 404 semplificata
            if (response.statusCode === 404) {
                console.warn(`⚠️ [404] Pagina non trovata: ${url}`);
                return null;
            }

            if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`✅ [${i + 1}/${retries}] Successo: ${url}`);
                return response.body;
            } else {
                console.warn(`⚠️ [${i + 1}/${retries}] Errore HTTP ${response.statusCode} per ${url}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            // Gestione errori senza mostrare l'HTML
            const errorMessage = error.response
                ? `Errore ${error.response.statusCode}: ${error.message}`
                : error.message;
            console.warn(`⚠️ [${i + 1}/${retries}] ${errorMessage}`);
            if (error.message.includes('Cloudflare')) {
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    console.error(`❌ Impossibile recuperare ${url}`);
    return null;
}

async function getMeta(id) {
    const meta = { id, type: 'series', name: '', poster: '', episodes: null };
    const cleanId = id.replace(/,/g, '-').toLowerCase();
    const baseId = cleanId.replace(/-\d{4}$/, '');
    const seriesLink = `https://ramaorientalfansub.tv/drama/${baseId}/`;

    if (metaCache.has(id)) {
        const cachedMeta = metaCache.get(id);
        return { meta: { ...cachedMeta } }; // Restituisci una copia per evitare modifiche dirette
    }

    try {
        const data = await fetchWithCloudscraper(seriesLink);
        if (!data) {
            console.warn(`Nessun dato ricevuto per ${seriesLink}`);
            return { meta };
        }

        const $ = cheerio.load(data);
        meta.name = $('a.text-accent').text().trim();
        meta.poster = $('img.wp-post-image').attr('src');

        // **NUOVA LOGICA PER RECUPERARE LA THUMBNAIL**
        let thumbnail = $('div.thumbnail_url_episode_list > img').attr('data-src'); // Prova a prendere l'immagine con il nuovo selettore
        if (!thumbnail) {
            thumbnail = $('img.wp-post-image').attr('src'); // Se non la trova, usa il metodo precedente
            console.log('Usando thumbnail wp-post-image'); // Log per debug
        } else {
            console.log('Usando thumbnail thumbnail_url_episode_list'); // Log per debug
        }

        meta.poster = thumbnail; // Assegna la thumbnail (trovata con uno dei due metodi) al poster

        let description = $('div.font-light > div:nth-child(1)').text().trim();
        if (meta.extra && meta.extra.tag) {
            description += ` [${meta.extra.tag.toUpperCase()}]`;
        }

        meta.description = description;
        meta.seriesLink = seriesLink;
        meta.baseId = baseId;
        metaCache.set(id, meta);

        // Recupera gli episodi
        meta.episodes = await getEpisodes(seriesLink, $, baseId); // Passa baseId a getEpisodes

        // Aggiungi i link degli episodi alla descrizione
        if (meta.episodes && meta.episodes.length > 0) {
            description += "\n\nEpisodi:\n";
            meta.episodes.forEach(episode => {
                description += `- ${episode.title}: ${episode.streams[0].url}\n`;
            });
        }

        metaCache.set(id, meta);
    } catch (error) {
        console.error('Errore nel caricamento dei dettagli della serie:', error);
    }

    return { meta };
}

async function getEpisodes(seriesLink, $, baseId) { // baseId come parametro
    try {
        const episodes = [];
        const baseEpisodeUrl = seriesLink.replace('/drama/', '/watch/');
        let seriesId = seriesLink.split('/').filter(Boolean).pop();
        seriesId = seriesId.replace(/,/g, '-').toLowerCase();
        seriesId = seriesId.replace(/--+/g, '-');
        let seriesYear = null;

        try {
            const titleText = $('title').text();
            const yearMatch = titleText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                seriesYear = yearMatch[0];
            }
        } catch (error) {
            console.error('Errore durante il recupero dell\'anno della serie:', error);
        }

        let episodeNumber = 1;
        while (true) {
            const episodeId = seriesYear ? `${baseId}-${seriesYear}` : baseId; // Usa baseId
            const episodeLink = `https://ramaorientalfansub.tv/watch/${episodeId}-episodio-${episodeNumber}/`;

            try {
                const stream = await getStream(episodeLink);
                if (!stream) {
                    console.warn(`Nessuno stream trovato per ${episodeLink}. Interrompo.`);
                    break; // Interrompi il ciclo while
                }

                const episodeData = await fetchWithCloudscraper(episodeLink);
                if (!episodeData) {
                    console.warn(`Nessun dato ricevuto per ${episodeLink} durante il recupero della miniatura.`);
                    break;
                }

                const $$ = cheerio.load(episodeData); // Usa un'istanza separata di Cheerio
                // **Selettore per la miniatura**
                const thumbnailElement = $$('div.thumbnail_url_episode_list img.lazyloaded');
                let thumbnailUrl = thumbnailElement.attr('data-src');
                if (!thumbnailUrl) {
                    thumbnailUrl = thumbnailElement.attr('src'); //Fallback a src
                }

                if (!thumbnailUrl) {
                    console.warn(`Nessuna miniatura trovata per ${episodeLink}`);
                    thumbnailUrl = null; // Imposta a null se non trovata
                }

                episodes.push({
                    id: `episodio-${episodeNumber}`,
                    title: `Episodio ${episodeNumber}`,
                    thumbnail: 'thumbnailUrl',
                    streams: [{
                        title: `Episodio ${episodeNumber}`,
                        url: stream,
                        type: "video/mp4"
                    }]
                });
            } catch (error) {
                console.error(`Errore durante il recupero dello stream per ${episodeLink}:`, error);
                break; // Interrompi il ciclo while anche in caso di errore
            }

            episodeNumber++;
        }
        return episodes;
    } catch (err) {
        console.error('Errore durante il recupero degli episodi:', err);
        return [];
    }
}

export { getMeta };
