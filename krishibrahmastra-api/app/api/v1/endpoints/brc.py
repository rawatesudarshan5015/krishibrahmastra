from fastapi import APIRouter, Depends, Query, HTTPException
from app.api.deps import get_current_user
from app.db.client import prisma

router = APIRouter()

@router.get("/near")
async def find_nearest_brc(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=25, le=200),
    current_user=Depends(get_current_user),
):
    """
    Returns BRCs within radius_km kilometres, ordered by distance.
    Uses PostGIS ST_DWithin with correct SRID 4326.
    """
    results = await prisma.query_raw(
        """
        SELECT
            id, name, "operatorType", address, "contactNumber",
            latitude, longitude,
            ROUND(
                (ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                ) / 1000)::numeric, 2
            ) AS distance_km
        FROM "BioResourceCenter"
        WHERE
            "isActive" = true
            AND ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                $3
            )
        ORDER BY distance_km ASC
        LIMIT 20
        """,
        lat, lng, radius_km * 1000  # ST_DWithin in geography mode takes metres
    )

    if not results:
        raise HTTPException(404, f"No BRCs found within {radius_km}km of your location")

    return results
