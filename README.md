# Flick

Learn the famous people and dates from the Life in the UK test by flicking cards to the right name.

## Develop

```sh
npm start          # http://localhost:8000
npm test
node build.mjs     # run after editing content/*.json
```

The content lives in `content/`. `people.json` and `dates.json` hold the facts, and `game.json` holds the rules and the level layout.

## Deploy

Each push to `main` runs the tests and deploys the site to GitHub Pages. To set this up once, go to **Settings → Pages → Source** and choose **GitHub Actions**.
