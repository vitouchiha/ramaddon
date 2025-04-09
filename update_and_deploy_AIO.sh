#!/bin/bash

# Configurazione utente per i commit
git config --global user.name "nomeutente"
git config --global user.email "nomeutente@example.com"  # Sostituisci con il tuo indirizzo email

# Aggiungi il remote upstream se non esiste
git remote get-url upstream || git remote add upstream https://github.com/SteveCelticus/ramaddon.git

# Sincronizziamo il fork con upstream
echo "Sincronizzando il fork con upstream..."
git fetch upstream

echo "Eseguendo il merge dal repository upstream..."
git checkout main
git merge upstream/main --allow-unrelated-histories || echo "Nessuna modifica da applicare."

# Aggiungiamo le modifiche al commit
echo "Aggiungendo modifiche al commit..."
git add .

# Commettiamo le modifiche
echo "Commettendo le modifiche..."
git commit -m "Sincronizzazione del fork con upstream e aggiornamento dei file"

# Pushing delle modifiche nel fork
echo "Pushing changes to the fork..."
git push origin main

echo "Operazione completata!"
