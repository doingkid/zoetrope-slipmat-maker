# RECORD DIG — preview

Static single-page browser app for curated mellow Japanese Lovers / Dub / Reggae vinyl, hosted as `docs/record-dig/` within the existing GitHub Pages project.

## Data

`records.json` is an array of public release records. The app also carries five fallback demonstration records in `index.html`. Fetchable `records.json` entries with matching `id` take precedence over fallbacks, and user-added local entries take precedence over both.

Schema per item (required fields: `id`, `artist`, `title`, `sides`):

```json
{
  "id": "stable-catalog-number",
  "artist": "Artist",
  "title": "A-side / B-side",
  "format": "7inch",
  "label": "Label",
  "cat": "ABC-001",
  "date": "2026-10-10",
  "price": 2640,
  "total": "¥2,640〜",
  "shipping": "1枚購入の送料・条件。未確認なら要確認",
  "limited": true,
  "score": 91,
  "rank": "S",
  "why": "試聴を聴いたうえでの短い選曲コメント",
  "buyUrl": "https://actual-product-page.example/item",
  "ownership": "所持状況は非公開。通知側で照合",
  "colors": ["#d0ad87", "#5b6d61"],
  "sides": {
    "A": {"title": "Side A", "kind": "youtube", "videoId": "11-char-id", "source": "label official"},
    "B": {"title": "Side B Dub", "kind": "external", "url": "https://actual-preview-page.example/item", "source": "vendor preview"}
  }
}
```

Supported `kind`: `youtube` (11-character verified ID, inline iframe), `audio` (authorized direct MP3, inline browser audio), `soundcloud` (official track URL, inline player), `bandcamp` (verified numeric albumId, inline player), or `external` (verified source page; opens externally). Do not assert an embed works without actually confirming. Don't spoof incorrect songs, album versions or remixes. Don't republish/download copyrighted previews or bypass hotlink protection. The page itself never automatically downloads audio for distribution.

**Privacy:** This is a public site. Do not put any personal ownership list, purchase history, email, Google Drive identifiers, or user/private data in `records.json` or fallback content. Ownership checks belong in the private notification workflow.

## Hosting

GitHub Pages is expected to serve `docs/record-dig/index.html` at a URL ending `/record-dig/` if the repository's Pages source is configured to publish `main` from `/docs`. If not, configure it under repository Settings → Pages. No build step is necessary.

## Mobile behavior

Autoplay is intentionally disabled. Tap the embedded YouTube player's play button after choosing a record. Native iOS browser restrictions can still prevent a provider's embed. If no verified embeddable source exists, the panel says so and links to the official preview page.
