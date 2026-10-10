from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.api.deps import require_admin
from app.db.client import prisma
from pydantic import BaseModel

router = APIRouter()

# ─── Chemical models ────────────────────────────────────────────────────────

class ChemicalCreate(BaseModel):
    name: str
    commonNames: list[str] = []
    category: str

class AlternativeCreate(BaseModel):
    name: str
    type: str
    preparationSteps: list[str]
    pros: list[str]
    cons: list[str]
    efficacyRating: float

# ─── BRC models ─────────────────────────────────────────────────────────────

class BRCCreate(BaseModel):
    name: str
    operatorType: str  # "Government" | "Cooperative" | "NGO"
    address: str
    contactNumber: str
    latitude: float
    longitude: float

class BRCUpdate(BaseModel):
    name: Optional[str] = None
    operatorType: Optional[str] = None
    address: Optional[str] = None
    contactNumber: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    isActive: Optional[bool] = None

# ─── Chemical endpoints ──────────────────────────────────────────────────────

@router.post("/chemicals", status_code=201)
async def create_chemical(body: ChemicalCreate, _=Depends(require_admin)):
    existing = await prisma.chemical.find_unique(where={"name": body.name.upper()})
    if existing:
        raise HTTPException(409, "Chemical already exists")
    chemical = await prisma.chemical.create(data={
        "name": body.name.upper(),
        "commonNames": body.commonNames,
        "category": body.category,
    })
    return chemical

@router.post("/chemicals/{chemical_id}/alternatives", status_code=201)
async def add_alternative(
    chemical_id: str, body: AlternativeCreate, _=Depends(require_admin)
):
    chemical = await prisma.chemical.find_unique(where={"id": chemical_id})
    if not chemical:
        raise HTTPException(404, "Chemical not found")
    alt = await prisma.alternative.create(data={
        "chemicalId": chemical_id,
        "name": body.name,
        "type": body.type,
        "preparationSteps": body.preparationSteps,
        "pros": body.pros,
        "cons": body.cons,
        "efficacyRating": body.efficacyRating,
    })
    return alt

@router.get("/chemicals")
async def list_chemicals(_=Depends(require_admin)):
    return await prisma.chemical.find_many(include={"alternatives": True})

# ─── Scan audit endpoints ────────────────────────────────────────────────────

@router.get("/scans")
async def list_scans(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    status: Optional[str] = Query(default=None, description="Filter by scan status: PENDING | PROCESSING | COMPLETED | FAILED"),
    _=Depends(require_admin)
):
    where = {}
    if status:
        valid_statuses = {"PENDING", "PROCESSING", "COMPLETED", "FAILED"}
        if status.upper() not in valid_statuses:
            raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        where["status"] = status.upper()

    skip = (page - 1) * limit
    scans = await prisma.scan.find_many(
        where=where,
        skip=skip,
        take=limit,
        include={"user": True},
        order={"createdAt": "desc"}
    )
    total = await prisma.scan.count(where=where)
    return {"data": scans, "total": total, "page": page, "limit": limit}

# ─── BRC management endpoints ────────────────────────────────────────────────

@router.post("/brc", status_code=201)
async def create_brc(body: BRCCreate, _=Depends(require_admin)):
    """
    Create a BRC. The PostGIS geom column is auto-populated via DB trigger
    from the latitude/longitude values.
    """
    brc = await prisma.bioresourcecenter.create(data={
        "name": body.name,
        "operatorType": body.operatorType,
        "address": body.address,
        "contactNumber": body.contactNumber,
        "latitude": body.latitude,
        "longitude": body.longitude,
    })
    return brc

@router.get("/brc")
async def list_brc(
    include_inactive: bool = Query(default=False),
    _=Depends(require_admin)
):
    """List all BRCs. Optionally include inactive ones."""
    where = {} if include_inactive else {"isActive": True}
    return await prisma.bioresourcecenter.find_many(
        where=where,
        order={"createdAt": "desc"}
    )

@router.put("/brc/{brc_id}")
async def update_brc(brc_id: str, body: BRCUpdate, _=Depends(require_admin)):
    """Update BRC details or toggle active status."""
    existing = await prisma.bioresourcecenter.find_unique(where={"id": brc_id})
    if not existing:
        raise HTTPException(404, "BRC not found")

    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")

    updated = await prisma.bioresourcecenter.update(
        where={"id": brc_id},
        data=data,
    )
    return updated
