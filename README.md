# VeganSwipe PWA 0.1

A local-first Progressive Web App for vegan recipe discovery on iPhone. It is designed to be hosted as a static site, added to the iPhone Home Screen, and used offline after the first recipe-library download.

## What works

- Dating-app style swipe cards: right = save, left = reject permanently, up = show later.
- Local IndexedDB persistence for recipes, saved/rejected/favorite state, settings, filters, and recommendation behavior.
- Full app shell cached by a Service Worker for offline startup.
- Large recipe import from Open Recipe Archive. The app fetches the collection index and all JSONL collections, normalizes recipes, classifies vegan candidates, computes realistic time estimates, simple Germany-oriented price estimates, approximate nutrition for common ingredients, cooking methods, and a healthy score, then saves everything locally.
- Temporary ingredient/cuisine/time/price/protein/calorie/method filters.
- Permanent ingredient exclusions and user-editable equipment.
- English UI by default, with German UI included.
- Saved recipes in grid/list view, search, sorting and favorites.
- 70/30 recommendation mix: preference-heavy ranking plus discovery variation.
- Personal-data backup/restore as JSON.

## Data source

Primary source: Open Recipe Archive by Adam Bouhmad.

- Current published corpus at implementation time: 54,843 historical recipes across 31 collections.
- The repository states that its exported historical recipes are sourced from public-domain materials or permissive supplements and carry provenance/license metadata.
- Source: https://github.com/AdamBouhmad/open-recipe-archive

The PWA does not bundle the 54k recipes inside the deployment. On first import it downloads the public JSONL collections directly and stores normalized records in IndexedDB on the device. This keeps the hosted app tiny and allows offline use after import.

## Fastest way to put it on an iPhone

1. Upload the contents of this folder to any HTTPS static host. Netlify Drop is an easy option: drag this folder or the ZIP to https://app.netlify.com/drop .
2. Open the resulting `https://...netlify.app` URL in Safari on the iPhone.
3. Tap Share -> Add to Home Screen -> Open as Web App.
4. Open VeganSwipe from the Home Screen.
5. Tap **Download recipes** and leave the app open until the first full import completes.
6. After that, the app shell and imported recipe database work offline. Internet is only needed to update/import more source data.

Important: PWA storage is local to Safari/WebKit on that iPhone. Use **Settings -> Export personal backup** periodically if likes/dislikes/favorites are important to you.

## Local testing

A Service Worker requires HTTP(S), not `file://`. From this folder run:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` on the same computer. iPhone installation requires HTTPS, so use a real static host for the phone.

## Known limitations

- Open Recipe Archive is historical and does not provide modern food photography. VeganSwipe therefore uses local visual placeholders instead of requiring remote images, which improves offline reliability.
- Vegan classification is rule-based and multilingual, not AI-based. It masks common false positives such as coconut milk, peanut butter, cocoa butter and eggplant, but any automatic classifier can still make mistakes. Source ingredient lists should be checked before cooking if strict vegan compliance matters.
- Nutrition and prices are estimates only; they are intentionally omitted when the local ingredient tables do not support a meaningful estimate.
- Historical recipes often do not provide servings or timing. The app uses a default of 4 servings and calculates a conservative realistic-time estimate from steps, ingredients and explicit durations.
