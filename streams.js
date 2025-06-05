import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.140 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/123.0.6312.122'
];

async function fetchWithCloudscraper(url, retries = 3) {
    function getRandomHeaders() {
        return {
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
            'Referer': 'https://ramaorientalfansub.live',
            'Accept-Language': 'en-US,en;q=0.9',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, br'
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
                console.warn(`[${i + 1}/${retries}] Errore 404 per ${url}. Interrompo i tentativi.`);
                return null;
            }

            if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`[${i + 1}/${retries}] Scraping riuscito: ${url}`);
                return response.body;
            } else {
                console.warn(`[${i + 1}/${retries}] Errore ${response.statusCode} per ${url}. Riprovo...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`[${i + 1}/${retries}] Errore Cloudscraper per ${url}: ${error.message}`);
            if (error.message.includes('Cloudflare')) {
                console.warn(`[${i + 1}/${retries}] Rilevato Cloudflare. Attendo 10 secondi...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else {
                console.warn(`[${i + 1}/${retries}] Errore generico. Attendo 2 secondi...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    console.error(`[FETCH_FAILED] Impossibile recuperare ${url} dopo ${retries} tentativi.`);
    return null;
}

async function getStream(episodeLink) {
    let streamUrl = null;
  
    try {
      const data = await fetchWithCloudscraper(episodeLink);
      if (!data) {
        console.warn(`Nessun dato ricevuto per ${episodeLink}`);
        return null;
      }
  
      const $ = cheerio.load(data);
  
      // Cerca l'iframe all'interno del div con classe 'episode-player-box'
      const iframe = $('div.episode-player-box iframe');
      if (iframe.length > 0) {
        streamUrl = iframe.attr('src') || iframe.attr('data-src');
        if (streamUrl) {
          streamUrl = decodeURI(streamUrl); // Decodifica l'URL
          console.log(`Trovato stream tramite iframe: ${streamUrl}`);
          return streamUrl;
        }
      }
  
      // Cerca nei tag video
      const videoTag = $('video[name="media"] source');
      if (videoTag.length > 0) {
        const sourceSrc = videoTag.attr('src');
        if (sourceSrc) {
          streamUrl = decodeURI(sourceSrc); // Decodifica l'URL
          console.log(`Trovato stream tramite tag <source>: ${streamUrl}`);
          return streamUrl;
        }
      }
  
      // Cerca nei link diretti
      $('a[href*="streamingrof.online"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('streamingrof.online')) {
          streamUrl = decodeURI(href); // Decodifica l'URL
          console.log(`Trovato stream tramite link diretto: ${streamUrl}`);
          return false; // Interrompe il ciclo
        }
      });
  
      if (!streamUrl) {
        console.warn(`Nessuno stream trovato per ${episodeLink}`);
      }
      
      return streamUrl;
      
    } catch (err) {
      console.error(`Errore durante il recupero dello stream per ${episodeLink}:`, err);
      return null;
    }
  }
  

export { getStream };
