# VeganSwipe PWA 0.2

A local-first personal iPhone web app for discovering **vegan main dishes** by swiping.

## What changed in 0.2

This version replaces the historical Open Recipe Archive import used by 0.1. The old source was broad, historical, multilingual and mostly image-less, so it was a poor fit for this app.

0.2 imports from the **Food Ingredients and Recipes Dataset with Images** (Epicurious-derived dataset). The dataset publisher describes 13,582 recipe rows and 13,582 corresponding food images and declares the dataset as **CC BY-SA 3.0**.

During import VeganSwipe keeps a recipe only when all of these checks pass:

- a corresponding real food image can be resolved;
- the title is readable/English-friendly;
- ingredients and instructions are present;
- the strict vegan ingredient check passes;
- the recipe is classified as a substantial main dish rather than a beverage, dessert, sauce, dip, snack or small appetizer.

The exact number that passes all checks is shown in **Settings → Data & offline** after import. VeganSwipe does not invent a target count and does not keep questionable recipes merely to increase the number.

## Data source

Recipe text / image mapping:
- Dataset: Food Ingredients and Recipes Dataset with Images
- Original listing: https://www.kaggle.com/datasets/pes12017000148/food-ingredients-and-recipe-dataset-with-images
- Declared license: CC BY-SA 3.0

For this browser-only personal build, the public GitHub mirror `kaveesh-kadirvel/Fridge2Fork` is used to fetch the CSV and corresponding image files at first import. No API key is required.

## GitHub Pages installation

1. Extract the ZIP.
2. Upload **the files inside the ZIP directly to the root of your GitHub repository**. Do not upload the ZIP itself.
3. In GitHub open **Settings → Pages**.
4. Choose **Deploy from a branch → main → / (root)**.
5. Open the generated GitHub Pages URL in Safari on your iPhone.
6. Tap **Share → Add to Home Screen → Open as Web App**.
7. Open VeganSwipe and tap **Download recipes** once while online.

## Updating an existing 0.1 installation

Replace the old repository files with the files from 0.2. Then open the GitHub Pages URL once in Safari while online and refresh it. The new app detects the old dataset version and automatically deletes the **old recipe records only** before the new import. Personal actions and settings are stored separately.

If iOS still shows the visibly old interface after GitHub Pages has finished deploying, close the installed web app and open the Pages URL in Safari again. As a last resort remove the Home Screen web app and add the same URL again; this does not change the files hosted on GitHub.

## Offline use

After import, recipe text, filters, likes/dislikes, favorites and settings are stored locally in IndexedDB. The PWA application shell is stored by a Service Worker.

Recipe photos are fetched from the image dataset and cached as they are displayed. In **Settings → Data & offline**, `Cache recipe photos for offline use` attempts to cache the photos for the entire local recipe feed. This can use substantial storage. If an uncached photo cannot be reached while offline, a local offline illustration is shown instead.

## Main behavior

- Swipe right: save / like
- Swipe left: reject permanently
- Swipe up: show later
- Rejected recipes are not shown again by default
- Saved recipes can be favorited
- Saved recipes have grid/list views
- Temporary and permanent ingredient exclusions use tap-to-select chips
- Optional/substitutable ingredients do not trigger a hard exclusion where detected
- Cuisine, method, realistic time, price, protein and calorie filters are tap-to-select
- Healthy preferences influence ranking rather than silently creating permanent exclusions
- Recommendation mix is approximately 70% preference match / 30% exploration
- Realistic cooking time is estimated from the recipe rather than blindly copying a source duration

## Privacy

There is no account, analytics service or app backend. Personal swipe history and preferences remain in the browser storage on the device unless you export a backup yourself.

## Limitations

The vegan/main-dish checks are conservative rules rather than medical or machine-learning classification. A strict check can reject some genuinely vegan recipes when an ingredient is ambiguous. Price and nutrition values are estimates where enough ingredient information is recognized. Full offline photo caching may consume significant device storage.
