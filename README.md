# Route Loader VS Code Extension

## Overview
Route Loader è un'estensione per Visual Studio Code che consente di caricare un file JSON esterno contenente definizioni di API e visualizzarle direttamente nell'editor. Ideale per sviluppatori che vogliono vedere velocemente le rotte API o le configurazioni mock senza uscire da VS Code.

## Features
- Caricamento di file JSON esterni tramite comando da palette.
- Parsing automatico e visualizzazione ordinata delle rotte.
- Supporto per file scelti manualmente.
- Leggero e semplice da integrare nel workflow.

## Prerequisites
Node.js (versione 14 o superiore), Visual Studio Code.

## Installation
Clona il progetto con `git clone https://github.com/tuo-utente/route-loader-extension.git` e spostati nella cartella: `cd route-loader-extension`. Installa le dipendenze con `npm install`. Compila il progetto con `npm run compile`.

## Running the Extension
Apri il progetto in VS Code, premi `F5` per avviare una nuova finestra con l’estensione attiva.

## Usage
Apri la Command Palette (`Ctrl+Shift+P` o `Cmd+Shift+P` su Mac), esegui il comando `Route Loader: Load JSON File`, seleziona il file JSON con le definizioni delle rotte. Visualizza i dati nel pannello output.


## Scripts
- `npm run compile` : compila TypeScript in JavaScript nella cartella out
- `npm run watch` : compila automaticamente a ogni modifica
- `npm run package` : crea il pacchetto `.vsix` per l’installazione manuale

## Publishing
Installa `vsce` globalmente con `npm install -g vsce`. Crea il pacchetto con `vsce package`. Pubblica su Marketplace con `vsce publish`.

## License
MIT © 2025 Angelo Capasso

---
