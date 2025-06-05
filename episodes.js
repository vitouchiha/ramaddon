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
            'Referer': 'https://ramaorientalfansub.live',
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
                resolveWithFullResponse: true
            });
            
            if (response.statusCode === 404) {
                console.warn(`⚠️ [404] Pagina non trovata: ${url}`);
                return null;
            }

            if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`✅ [${i + 1}/${retries}] Successo: ${url}`);
                return response.body;
            }

            console.warn(`⚠️ [${i + 1}/${retries}] Errore HTTP ${response.statusCode} per ${url}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            
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
    const meta = { id, type: 'series', poster: '', episodes: null };
    const cleanId = id.replace(/,/g, '-').toLowerCase();
    const baseId = cleanId.replace(/-\d{4}$/, '');
    const seriesLink = `https://ramaorientalfansub.live/drama/${baseId}/`;
    if (metaCache.has(id)) {
        const cachedMeta = metaCache.get(id);
        return { meta: { ...cachedMeta } };
    }

    try {
        const data = await fetchWithCloudscraper(seriesLink);
        if (!data) {
            console.warn(`Nessun dato ricevuto per ${seriesLink}`);
            return { meta };
        }

        const $ = cheerio.load(data);

        // Estrai il valore di 'state' PRIMA di utilizzarlo
        let state = $('span.font-normal:nth-child(1)').text().trim();

        // Estrai il nome della serie
        meta.name = $('a.text-accent').text().trim();

        let show = '';
        let rating = '';
        let adultContent = ''; // Aggiungi una variabile per tracciare il contenuto per adulti
        
        $('li.list-none').each(function() {
            const text = $(this).text().trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
            if (text.includes('Episodi')) {
                show = text;
            }
            if (text.includes('Valutazione')) {
                rating = text;
        
                // Controlla se il testo del rating contiene "18" o "vietato ai minori"
                if (text.toLowerCase().includes('18+') || text.toLowerCase().includes('Restricted')) {
                    adultContent = ' 🔞 '; // Imposta la variabile se è contenuto per adulti
                     
                
                }
            }
            // Se vuoi uscire solo dopo aver trovato entrambi
            if (show && rating) return false;
        });
        
        // Mantieni questo poster, è l'immagine principale della serie
        meta.poster = $('.anime-image > img:nth-child(1)').attr('src');
        
        // Aggiungi 'state' prima della descrizione
        let description = `${state} - ${show}\n${rating}${adultContent}\n${$('div.font-light > div:nth-child(1)').text().trim()}`;
      
        const extraTextElement = $('span.font-normal.leading-6');
        const extraText = extraTextElement.text().trim();

        if (extraText) {
           console.log(`Testo aggiunto alla descrizione: ${state} - ${show}`);
        } else {
            console.log('Nessun testo trovato con il selettore specificato.');
        }

        if (meta.extra && meta.extra.tag && meta.show) {
            description += ` ${meta.show.toUpperCase()}]`;
        }

        meta.description = description;
        meta.seriesLink = seriesLink;
        meta.baseId = baseId;
        metaCache.set(id, meta);

        meta.episodes = await getEpisodes(seriesLink, $);

        if (meta.episodes && meta.episodes.length > 0) {
            meta.episodes.forEach(episode => {
                `- ${episode.title}: ${episode.streams[0].url}\n`;
            });
            meta.description = description;
            metaCache.set(id, meta);
            return { meta };
        } else {
            console.warn(`Nessun episodio trovato per ${seriesLink}`);
            return { meta };
        }
    } catch (error) {
        console.error('Errore nel caricamento dei dettagli della serie:', error);
        return { meta };
    }
}


async function getEpisodes(seriesLink, $) {
    try {
        const episodes = [];
        
        let seriesId = seriesLink.split('/').filter(Boolean).pop();
        seriesId = seriesId.replace(/,/g, '-').toLowerCase();
        seriesId = seriesId.replace(/--+/g, '-');
        let seriesYear = null;
        try {
            const titleText = $('title').text();
            const yearMatch = titleText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                seriesYear = yearMatch[0];
                console.log(`Anno della serie trovato: ${seriesYear}`);
            }
        } catch (error) {
            console.error('Errore durante il recupero dell\'anno della serie:', error);
        }

        // **NUOVA LOGICA PER LE THUMBNAIL (corretta)**
        const episodeElements = $('.swiper-slide a div img').toArray();
        for (let i = 0; i < episodeElements.length; i++) { 
            const element = episodeElements[i];
            const episodeNumber = i + 1;
            const thumbnailUrl = $(element).attr('src');
            if (thumbnailUrl) {
                const episodeLink = `https://ramaorientalfansub.live/watch/${seriesId}-${seriesYear}-episodio-${episodeNumber}/`;
                const streamUrl = await getStream(episodeLink);
                episodes.push({
                    id: `episodio-${episodeNumber}`,
                    title: `Episodio ${episodeNumber}`,
                    thumbnail: thumbnailUrl,
                    streams: [{
                        title: `Episodio ${episodeNumber}`,
                        url: streamUrl || episodeLink,
                        type: "video/mp4"
                    }]
                });
            } else {
                console.warn(`Nessuna thumbnail trovata per l'episodio ${episodeNumber}`);
            }
        }
        return episodes;
    } catch (err) {
        console.error('Errore durante il recupero degli episodi:', err);
        return [];
    }
}

export { getMeta, getEpisodes };
