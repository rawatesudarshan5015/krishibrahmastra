CREATE INDEX IF NOT EXISTS brc_geom_idx ON "BioResourceCenter" USING GIST (geom);

CREATE OR REPLACE FUNCTION sync_brc_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brc_geom_sync ON "BioResourceCenter";
CREATE TRIGGER brc_geom_sync
BEFORE INSERT OR UPDATE ON "BioResourceCenter"
FOR EACH ROW EXECUTE FUNCTION sync_brc_geom();
