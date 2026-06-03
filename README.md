# P-P-Custom

## Database

Las migraciones de Drizzle viven en `apps/api/migrations`.

```sh
pnpm --dir apps/api db:generate
pnpm --dir apps/api db:migrate
```

También puedes correrlos desde `apps/api`:

```sh
pnpm db:generate
pnpm db:migrate
```

Para apuntar a `DATABASE_URL_DEV`, define `ENVIROMENT=dev` en `apps/api/.env` o pásalo en el comando:

```sh
ENVIROMENT=dev pnpm --dir apps/api db:migrate
```
