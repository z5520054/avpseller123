# AVP Seller Deployment

## Production VPS

- Host: `109.107.190.66`
- User: `root`
- Frontend path: `/opt/pixel-silk/current`
- Backend path: `/opt/pixel-silk/backend`
- Systemd service: `pixel-silk-catalog.service`
- Backend port: `8787`
- Public domain: `https://avpseller.ru`
- Health check: `https://avpseller.ru/health`

## Secrets

Do not commit passwords, admin tokens, SSH keys, or `.env` files to git.

Use local environment variables or Codex/GitHub secrets:

- `AVP_VPS_HOST`
- `AVP_VPS_USER`
- `AVP_VPS_PASSWORD` or SSH key
- `ADMIN_TOKEN`

## Manual Deploy Outline

1. Build frontend locally:

```bash
npm run build
```

2. Upload `dist/` to `/opt/pixel-silk/current`, preserving `/opt/pixel-silk/current/uploads`.

3. Upload backend files to `/opt/pixel-silk/backend`:

```text
server/
package.json
package-lock.json
tsconfig.json
tsconfig.server.json
```

4. Restart API:

```bash
systemctl restart pixel-silk-catalog.service
```

5. Verify:

```bash
curl -fsS http://127.0.0.1:8787/health
curl -fsS https://avpseller.ru/health
```

## Important Runtime Files

These are intentionally ignored by git:

- `data/catalog.sqlite`
- repair JSONL snapshots
- downloaded prod DB snapshots
- frontend `dist/`
- `node_modules/`

