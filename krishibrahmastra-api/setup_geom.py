import asyncio
from app.db.client import prisma

async def main():
    await prisma.connect()
    print("Applying PostGIS setup...")
    
    await prisma.execute_raw('CREATE INDEX IF NOT EXISTS brc_geom_idx ON "BioResourceCenter" USING GIST (geom);')
    
    await prisma.execute_raw('''
    CREATE OR REPLACE FUNCTION sync_brc_geom()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    ''')
    
    await prisma.execute_raw('DROP TRIGGER IF EXISTS brc_geom_sync ON "BioResourceCenter";')
    await prisma.execute_raw('''
    CREATE TRIGGER brc_geom_sync
    BEFORE INSERT OR UPDATE ON "BioResourceCenter"
    FOR EACH ROW EXECUTE FUNCTION sync_brc_geom();
    ''')
    
    print("Setup complete.")
    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
