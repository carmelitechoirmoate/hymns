# Carmelite Choir Hymns

The Carmelite choir's hymn book: full lyrics, sheet music where we have it,
and a record of what we sang each Sunday. Built with [Antora](https://antora.org)
from AsciiDoc files and published to GitHub Pages at
https://quis-ut-deus.github.io/carmelite-choir/.

**To add or change a hymn, read the "Adding a hymn" page on the site**
(`modules/ROOT/pages/adding-hymns.adoc`). Everything can be done in the browser
on github.com; the site rebuilds itself after each commit.

## Layout

| Path | What |
|---|---|
| `modules/ROOT/pages/hymns/` | One file per hymn. The header lines (`:composer:`, `:season:` ...) drive the details, filters and sheet music. |
| `modules/ROOT/pages/sundays/` | One file per Sunday or feast, named by date, listing the hymns sung. |
| `modules/ROOT/images/sheet-music/` | Sheet music photos and scans. |
| `modules/ROOT/attachments/audio/` | Recordings (e.g. voice notes from the choir WhatsApp group). |
| `templates/` | Blank hymn and Sunday files to copy. |
| `lib/hymn-book.js` | Antora extension: builds the menu, the hymn index, the Sunday archive and the extras on each hymn page. You shouldn't need to touch it. |
| `supplemental-ui/` | Look and feel (Carmelite brown and gold, phone-first) on top of the Antora default UI. |
| `.github/workflows/deploy.yml` | Builds the site and publishes it to GitHub Pages on every push to `main`. |

## Build and preview on a computer

```bash
npm ci
npm run build          # writes build/site
npm run preview        # http://localhost:4000/
```

## One-off GitHub setup

1. Create the repository `carmelite-choir` under the `quis-ut-deus` account and push this folder to `main`.
2. In the repository, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. The first push builds and publishes the site.
