-- 002_geography.sql — Governorates

CREATE TABLE governorates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  region      TEXT NOT NULL,  -- cairo_metro|delta|upper_egypt|canal|sinai|border
  centroid    GEOMETRY(Point, 4326),
  boundary    GEOMETRY(MultiPolygon, 4326),
  code        TEXT UNIQUE
);
