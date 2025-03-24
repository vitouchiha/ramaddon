# Usa una immagine di Node.js come base
FROM node:20-alpine

# Imposta la directory di lavoro all'interno del container
WORKDIR /app

RUN npm install -g npm@11.2.0

# Copia i file package.json e package-lock.json (se presente)
COPY package.json ./

RUN npm cache clean --force

# Installa le dipendenze del progetto
RUN npm install

# Copia il resto dei file del progetto nella directory di lavoro
COPY . .

# Definisci la variabile d'ambiente (opzionale)
# ENV PROXY_URL=""

# Esponi la porta su cui l'addon sarà in ascolto
EXPOSE 7000

# Comando per avviare l'applicazione
CMD [ "node", "main.js" ]
