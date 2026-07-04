# E2E API para Frontend

Esta API expone fixtures normalizados desde API-Football, insights por fase y operaciones de polling.

## Preparacion local

Importar historia local:

```bash
pnpm.cmd historical:import
```

Simular Mundial 2022 con los JSON de `src/from-api`:

```bash
pnpm.cmd api-football:simulate-2022
```

## Fixtures

Listado de partidos:

```http
GET /api/fixtures?season=2022
```

Partidos live:

```http
GET /api/fixtures/live?season=2022
```

Detalle de partido:

```http
GET /api/fixtures/AF-2022-979139
```

Eventos normalizados/procesados:

```http
GET /api/fixtures/AF-2022-979139/events
```

## Insights

Todos los insights de un partido:

```http
GET /api/fixtures/AF-2022-979139/insights
```

Por fase:

```http
GET /api/fixtures/AF-2022-979139/insights?phase=pre_match
GET /api/fixtures/AF-2022-979139/insights?phase=live
GET /api/fixtures/AF-2022-979139/insights?phase=post_match
```

Generar insights pre partido:

```http
POST /api/fixtures/AF-2022-979139/insights/pre/generate
```

Generar insights post partido:

```http
POST /api/fixtures/AF-2022-979139/insights/post/generate
```

## Polling

Estado general:

```http
GET /api/polling/status
```

Estado de un partido:

```http
GET /api/polling/status?matchId=AF-2022-979139
```

Iniciar polling de un fixture:

```http
POST /api/polling/fixtures/AF-2022-979139/start
Content-Type: application/json

{
  "intervalSeconds": 60
}
```

Detener polling:

```http
POST /api/polling/fixtures/AF-2022-979139/stop
```

## Mappings

Listar mappings:

```http
GET /api/mappings?entityType=team
GET /api/mappings?entityType=player
GET /api/mappings?entityType=match
```

Crear o corregir mapping manual:

```http
POST /api/mappings
Content-Type: application/json

{
  "provider": "api-football",
  "entityType": "player",
  "externalId": "154",
  "localId": "P-06410",
  "metadata": {
    "apiName": "L. Messi",
    "localName": "Lionel Messi"
  }
}
```

Cobertura de normalizacion:

```http
GET /api/mappings/coverage?season=2022
```

## Dev

Ejecutar simulacion 2022 desde HTTP:

```http
POST /api/dev/api-football/simulate-2022
```

Esto importa fixtures 2022, carga la final detallada, genera pre-match insights, procesa eventos live y genera post-match insights.
