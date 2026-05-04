# Catalog Pipeline

## Goal

Build a catalog system that can support thousands of PlayStation Store SKUs with:

- normalized product catalog
- current offers by region/currency
- price and discount history
- enriched product-page details
- scheduled refresh jobs
- API for storefront filters/search

## Source policy

Primary business source is the official PlayStation Store.

Important:

- The PlayStation website includes restrictions around automated scraping / data mining.
- This repository now includes a live HTML ingestion path that reads embedded `__NEXT_DATA__` payloads from public PS Store pages for `en-in` and `en-tr`.
- That path is technically viable for catalog sync, but it still needs business/legal review before being treated as a production-safe integration.
- For development and fallback, the sample JSON provider remains available.

## Data model

### Products

- source / source key
- title / slug
- kind
- product url
- cover url
- release date
- publisher / developer
- status
- platforms
- tags

### Offers

- region
- currency
- base price
- discounted price
- discount percent
- sale start / end
- plus tier
- sale name
- availability

### Price history

Every sync stores a snapshot of price state for trend/history analysis.

### Sync runs

Import runs are tracked for visibility:

- provider
- mode (`full`, `prices`)
- status
- counts
- error text

## Schedules

Recommended defaults:

- full catalog sync: daily
- price sync: every 3-6 hours
- flash-sale refresh: hourly when needed

Current env defaults:

- `CATALOG_SYNC_CRON=0 3 * * *`
- `PRICE_SYNC_CRON=0 */6 * * *`

## Commands

```bash
npm run server:start
npm run server:check
npm run catalog:sync:sample
npm run catalog:sync:playstation
npm run catalog:sync:playstation:prices
npm run catalog:details:playstation
```

Testing aid:

- set `PLAYSTATION_MAX_PAGES=2` to cap page traversal while verifying the importer

Current PS Store scopes:

- `All Deals`: `3f772501-f6f8-49b7-abac-874a88ca4897`
- `Pre-orders`: `3bf499d7-7acf-4931-97dd-2667494ee2c9`
- `Subscriptions`: `/{locale}/pages/subscriptions`

Product detail enrichment:

- fetches public `/{locale}/product/{productId}` pages
- unpacks `pageProps.batarangs` payloads
- stores long description, hero/media, rating, genres, languages, compatibility notices, add-ons
- also captures region sale end when Sony exposes it in CTA payload

## API

- `GET /health`
- `GET /api/catalog`
- `GET /api/catalog/filters`
- `GET /api/catalog/:id`
- `GET /api/catalog/:id/details`
- `GET /api/catalog/:id/history`
- `GET /api/sync-runs`
