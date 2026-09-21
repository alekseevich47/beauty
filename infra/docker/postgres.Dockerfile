# PostgreSQL 17 with PostGIS and pgvector.
# The stock postgis image does not ship pgvector, and the schema needs both
# (geo search for "masters nearby" plus embeddings), so they are combined here.
FROM postgis/postgis:17-3.5

ARG PGVECTOR_PKG=postgresql-17-pgvector

RUN apt-get update \
  && apt-get install -y --no-install-recommends ${PGVECTOR_PKG} \
  && rm -rf /var/lib/apt/lists/*
