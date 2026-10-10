"""
seed.py — Run once to populate chemicals, bio-alternatives, and BRC centers.

Usage (inside the API container):
    docker exec -it <api-container-name> python seed.py

Or on the host (with DATABASE_URL pointing to postgres):
    python seed.py
"""
import asyncio
from app.db.client import prisma

# ─── Seed data ────────────────────────────────────────────────────────────────

CHEMICALS = [
    {
        "name": "IMIDACLOPRID",
        "category": "Insecticide",
        "commonNames": ["Confidor", "Gaucho", "Admire", "Merit"],
        "alternatives": [
            {
                "name": "Neem Oil Spray",
                "type": "Botanical",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Mix 5 ml cold-pressed neem oil per litre of water",
                    "Add 2-3 drops of liquid soap as emulsifier and shake well",
                    "Spray thoroughly on undersides of leaves at dusk or early morning",
                    "Repeat every 7–10 days or after rain",
                ],
                "pros": [
                    "Safe for humans, birds and mammals",
                    "Disrupts insect hormone system — no resistance buildup",
                    "Biodegrades within 1–2 weeks",
                ],
                "cons": [
                    "Degrades quickly in sunlight — spray at dusk",
                    "Less effective against adult insects; targets larvae best",
                    "Requires repeat applications",
                ],
            },
            {
                "name": "Beauveria bassiana",
                "type": "Microbial",
                "efficacyRating": 4.5,
                "preparationSteps": [
                    "Dissolve 5 g of Beauveria bassiana wettable powder per litre of water",
                    "Add a small amount of sticker-spreader",
                    "Apply as a foliar spray in the evening when humidity is >70%",
                    "Store unused solution in a cool dark place for up to 24 hours",
                ],
                "pros": [
                    "Targets whiteflies, aphids, thrips — same pests as imidacloprid",
                    "Self-perpetuating — fungal spores spread within pest population",
                    "No pre-harvest interval required",
                ],
                "cons": [
                    "Ineffective in hot, dry conditions — needs humidity above 70%",
                    "Slower acting (5–7 days to peak effect)",
                    "Cannot be tank-mixed with fungicides",
                ],
            },
        ],
    },
    {
        "name": "CYPERMETHRIN",
        "category": "Insecticide",
        "commonNames": ["Ripcord", "Cymbush", "Sherpa", "Barricade"],
        "alternatives": [
            {
                "name": "Pyrethrin Extract (Chrysanthemum)",
                "type": "Botanical",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Use commercially available pyrethrin concentrate at 2 ml per litre",
                    "Mix in water with a small amount of soap as carrier",
                    "Spray directly on pest colonies in morning",
                    "Reapply after 5–7 days",
                ],
                "pros": [
                    "Fast knockdown — kills on contact within minutes",
                    "Degrades completely within 24–48 hours",
                    "Derived from chrysanthemum flowers — naturally sourced",
                ],
                "cons": [
                    "Toxic to bees during application — spray when bees are inactive",
                    "No residual protection — requires frequent application",
                    "Expensive compared to synthetic options",
                ],
            },
            {
                "name": "Spinosad",
                "type": "Microbial",
                "efficacyRating": 4.5,
                "preparationSteps": [
                    "Mix spinosad concentrate at 0.5 ml per litre of water",
                    "Shake solution well before spraying",
                    "Apply to foliage covering tops and undersides of leaves",
                    "Allow 4-day interval between applications to prevent resistance",
                ],
                "pros": [
                    "Derived from soil bacteria Saccharopolyspora spinosa",
                    "OMRI-listed for organic farming",
                    "Effective against caterpillars, thrips, leafminers",
                ],
                "cons": [
                    "Toxic to bees if sprayed on flowers — avoid bloom period",
                    "Pricier than conventional options",
                    "Rotate with other modes of action to prevent resistance",
                ],
            },
        ],
    },
    {
        "name": "CHLORPYRIFOS",
        "category": "Insecticide",
        "commonNames": ["Dursban", "Lorsban", "Coroban", "Radar"],
        "alternatives": [
            {
                "name": "Neem Kernel Extract (NSKE 5%)",
                "type": "Botanical",
                "efficacyRating": 3.5,
                "preparationSteps": [
                    "Crush 500 g neem kernels and soak overnight in 10 litres of water",
                    "Strain through muslin cloth to remove solids",
                    "Add 10 g soap powder and stir to mix",
                    "Spray on crops in morning or evening — repeat every 10 days",
                ],
                "pros": [
                    "Prepared from locally available neem kernels — very low cost",
                    "Effective antifeedant — pests stop feeding within hours",
                    "Safe for earthworms and soil biology",
                ],
                "cons": [
                    "Labour-intensive to prepare",
                    "Strong odour — may be unpleasant during application",
                    "Shelf life of prepared solution is only 8 hours",
                ],
            },
            {
                "name": "Metarhizium anisopliae",
                "type": "Microbial",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Mix 5 g Metarhizium anisopliae per litre of water",
                    "Apply as soil drench at base of plants for soil pests",
                    "For foliar pests, spray in evening with high humidity",
                    "Repeat after 15 days if pest pressure continues",
                ],
                "pros": [
                    "Highly effective against termites, grubs and soil insects",
                    "Persists in soil for multiple seasons",
                    "Compatible with most organic fertilizers",
                ],
                "cons": [
                    "Slow acting — 10–14 days for full effect",
                    "Cannot be mixed with chemical fungicides",
                    "Requires cool storage (below 25°C)",
                ],
            },
        ],
    },
    {
        "name": "GLYPHOSATE",
        "category": "Herbicide",
        "commonNames": ["Roundup", "Glycel", "Excel Mera 71", "Weedmar"],
        "alternatives": [
            {
                "name": "Acetic Acid (Vinegar) Weed Spray",
                "type": "Mineral",
                "efficacyRating": 3.0,
                "preparationSteps": [
                    "Use 20% acetic acid (horticultural vinegar) undiluted",
                    "Add 1 teaspoon of table salt and a few drops of dish soap per litre",
                    "Spray directly on weed foliage on a sunny, dry day",
                    "Avoid contact with desirable plants — this is non-selective",
                    "May need 2–3 applications for perennial weeds",
                ],
                "pros": [
                    "Breaks down within hours — no soil residue",
                    "Kills top growth immediately — visible effect within hours",
                    "Widely available and inexpensive",
                ],
                "cons": [
                    "Does not kill root system of perennial weeds",
                    "Non-selective — will kill any plant it contacts",
                    "Strong acid — use gloves and eye protection",
                ],
            },
            {
                "name": "Mulching + Manual Weeding",
                "type": "Botanical",
                "efficacyRating": 4.5,
                "preparationSteps": [
                    "Apply 5–10 cm thick layer of straw, dried leaves or crop residue around plants",
                    "Ensure mulch doesn't touch plant stems directly",
                    "Combine with hand-weeding for emerged weeds",
                    "Refresh mulch layer as it decomposes",
                ],
                "pros": [
                    "Zero chemical input — no residue, no resistance",
                    "Improves soil moisture retention and adds organic matter",
                    "Long-lasting weed suppression (6–8 weeks per application)",
                ],
                "cons": [
                    "Labour-intensive for large areas",
                    "Can harbour slugs and rodents if too thick",
                    "Material sourcing required at scale",
                ],
            },
        ],
    },
    {
        "name": "MANCOZEB",
        "category": "Fungicide",
        "commonNames": ["Dithane M-45", "Indofil M-45", "Kavach", "Uthane"],
        "alternatives": [
            {
                "name": "Trichoderma viride Bio-fungicide",
                "type": "Microbial",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Mix 10 g Trichoderma viride powder per litre of water",
                    "Apply as soil drench at 250 ml per plant at transplanting",
                    "For foliar use, spray 5 g per litre every 15 days",
                    "Do not mix with chemical fungicides",
                ],
                "pros": [
                    "Controls damping-off, root rot, and wilt diseases",
                    "Promotes plant growth through root colonization",
                    "Safe for farm workers with no PHI (pre-harvest interval)",
                ],
                "cons": [
                    "Incompatible with chemical fungicides — must use separately",
                    "Requires cool, moist conditions to work well",
                    "Shelf life limited to 6 months from manufacture",
                ],
            },
            {
                "name": "Copper Oxychloride Spray",
                "type": "Mineral",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Dissolve 3 g copper oxychloride per litre of water",
                    "Spray uniformly on all plant surfaces",
                    "Apply at first sign of disease or preventively before monsoon",
                    "Do not apply in temperatures above 35°C — may cause leaf burn",
                ],
                "pros": [
                    "Broad-spectrum fungicide — controls blight, downy mildew, leaf spot",
                    "Approved for use in organic agriculture",
                    "Long residual action — lasts 10–14 days",
                ],
                "cons": [
                    "Can accumulate in soil over years — limit to 6 kg Cu/ha/year",
                    "May cause phytotoxicity (leaf burn) on sensitive crops",
                    "Stains produce blue-green — observe 7-day PHI",
                ],
            },
        ],
    },
    {
        "name": "UREA",
        "category": "Fertiliser",
        "commonNames": ["Chambal Urea", "IFFCO Urea", "NFL Urea"],
        "alternatives": [
            {
                "name": "Compost + Vermicompost",
                "type": "Botanical",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Apply 2–5 tonnes of well-decomposed farmyard compost per acre before sowing",
                    "Supplement with 500 kg vermicompost per acre as side-dressing",
                    "Incorporate into top 10 cm of soil by light tillage",
                    "Top-dress with vermicompost tea (1:10 dilution) every 30 days",
                ],
                "pros": [
                    "Improves soil structure, water retention and microbial life",
                    "Provides slow-release nitrogen alongside phosphorus, potassium and micronutrients",
                    "Zero cost when produced on-farm from crop residues",
                ],
                "cons": [
                    "Nitrogen content is much lower than urea (1–2% vs 46%)",
                    "Large volumes required — logistically challenging at scale",
                    "Nutrient release is slow — not suitable for acute deficiency",
                ],
            },
            {
                "name": "Jeevamrut (Bio-stimulant)",
                "type": "Microbial",
                "efficacyRating": 3.5,
                "preparationSteps": [
                    "Mix 10 kg fresh cow dung, 10 litres cow urine, 2 kg jaggery, 2 kg pulse flour and 1 handful of soil from farm bund",
                    "Add to 200 litres of water and stir daily for 48 hours",
                    "Filter and dilute 1:10 with water for foliar spray or 1:5 for soil drench",
                    "Apply every 15 days — use within 7 days of preparation",
                ],
                "pros": [
                    "Activates native soil microorganisms — builds long-term fertility",
                    "Extremely low cost — all ingredients locally available",
                    "Endorsed by Zero Budget Natural Farming (ZBNF) system",
                ],
                "cons": [
                    "Strong odour — can be unpleasant to prepare and apply",
                    "Requires consistent cow dung and urine supply",
                    "Results take 1–2 seasons to become fully visible",
                ],
            },
        ],
    },
    {
        "name": "ATRAZINE",
        "category": "Herbicide",
        "commonNames": ["Atrataf", "Rasayanzine", "Gesaprim"],
        "alternatives": [
            {
                "name": "Inter-row Mechanical Cultivation",
                "type": "Mineral",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Use a wheel hoe or power weeder between crop rows 10–15 days after sowing",
                    "Make a second pass at 25–30 days before canopy closure",
                    "Adjust blade depth to avoid disturbing crop roots (max 3–5 cm)",
                    "Combine with hand-weeding within the row for complete control",
                ],
                "pros": [
                    "No chemical input — zero residue in soil or crop",
                    "Also aerates soil and breaks surface crust",
                    "Effective against both broadleaf and grass weeds",
                ],
                "cons": [
                    "Requires implements — not effective in very wet soils",
                    "Labour requirement increases with field size",
                    "Cannot control weeds within the crop row",
                ],
            },
        ],
    },
    {
        "name": "CARBENDAZIM",
        "category": "Fungicide",
        "commonNames": ["Bavistin", "Derosal", "Carben", "Agrozim"],
        "alternatives": [
            {
                "name": "Pseudomonas fluorescens",
                "type": "Microbial",
                "efficacyRating": 4.0,
                "preparationSteps": [
                    "Mix 10 g Pseudomonas fluorescens wettable powder per litre of water",
                    "Treat seeds by soaking for 30 minutes before sowing",
                    "Apply as soil drench at 2.5 kg per acre dissolved in 200 litres of water",
                    "Repeat foliar spray every 21 days during humid season",
                ],
                "pros": [
                    "Controls Fusarium wilt, blast, sheath blight",
                    "Plant growth promoting — produces auxins and siderophores",
                    "No PHI — can be applied up to harvest",
                ],
                "cons": [
                    "Sensitive to UV — spray in evening or early morning",
                    "Cannot be mixed with chemical pesticides",
                    "Short shelf life (6 months) — check manufacture date",
                ],
            },
            {
                "name": "Bordeaux Mixture",
                "type": "Mineral",
                "efficacyRating": 4.5,
                "preparationSteps": [
                    "Dissolve 1 kg copper sulphate in 50 litres of water in a plastic container",
                    "In a second container, dissolve 1 kg hydrated lime in 50 litres of water",
                    "Slowly pour copper solution into lime solution while stirring — never reverse",
                    "Check pH (should be 7–8) and spray immediately — do not store",
                ],
                "pros": [
                    "Time-tested formula used for over 100 years",
                    "Controls a very wide range of fungal and bacterial diseases",
                    "Permitted in organic agriculture in most countries",
                ],
                "cons": [
                    "Must be prepared fresh before each application — cannot be stored",
                    "Copper accumulation in soil at high rates over many years",
                    "Heavy coating on produce — observe 14-day pre-harvest interval",
                ],
            },
        ],
    },
]

# ─── BRC Centers (Maharashtra, India) ─────────────────────────────────────────

BRCS = [
    {
        "name": "Pune District Bio-Input Resource Centre",
        "operatorType": "Government",
        "address": "Survey No. 45, Hadapsar, Pune – 411028, Maharashtra",
        "contactNumber": "+91 20 2689 4521",
        "latitude": 18.4990,
        "longitude": 73.9397,
    },
    {
        "name": "Nashik Krishi Bio-Input Kendra",
        "operatorType": "Cooperative",
        "address": "Near APMC Yard, Deolali Camp, Nashik – 422401, Maharashtra",
        "contactNumber": "+91 253 246 7890",
        "latitude": 19.9975,
        "longitude": 73.8543,
    },
    {
        "name": "Aurangabad BRC – Marathwada Agricultural University",
        "operatorType": "Government",
        "address": "VNMKV Campus, Parbhani Road, Aurangabad – 431005, Maharashtra",
        "contactNumber": "+91 240 237 1234",
        "latitude": 19.8762,
        "longitude": 75.3433,
    },
    {
        "name": "Nagpur Bio-Inputs Centre – Vidarbha",
        "operatorType": "NGO",
        "address": "Plot 12, MIDC Hingna, Nagpur – 441110, Maharashtra",
        "contactNumber": "+91 712 268 5500",
        "latitude": 21.1458,
        "longitude": 79.0882,
    },
    {
        "name": "Kolhapur Shetakari Bio-Input Kendra",
        "operatorType": "Cooperative",
        "address": "Near Karveer Naka, Rajaram Road, Kolhapur – 416003, Maharashtra",
        "contactNumber": "+91 231 265 3344",
        "latitude": 16.7050,
        "longitude": 74.2433,
    },
]

# ─── Seeder ───────────────────────────────────────────────────────────────────

async def seed():
    await prisma.connect()
    chem_count = 0
    alt_count = 0
    brc_count = 0

    try:
        print("\n🌱  Seeding chemicals and bio-alternatives...")
        for chem_data in CHEMICALS:
            alts = chem_data.pop("alternatives")

            # Upsert chemical (skip if already exists)
            existing = await prisma.chemical.find_unique(
                where={"name": chem_data["name"]}
            )
            if existing:
                chemical = existing
                print(f"  ⏭  {chem_data['name']} already exists — skipping")
            else:
                chemical = await prisma.chemical.create(data=chem_data)
                chem_count += 1
                print(f"  ✅  Created chemical: {chemical.name}")

            # Seed alternatives for this chemical
            for alt_data in alts:
                # Check if alternative with same name already exists for this chemical
                existing_alts = await prisma.alternative.find_many(
                    where={"chemicalId": chemical.id, "name": alt_data["name"]}
                )
                if existing_alts:
                    print(f"       ⏭  Alternative '{alt_data['name']}' already exists")
                    continue
                await prisma.alternative.create(data={
                    **alt_data,
                    "chemicalId": chemical.id,
                })
                alt_count += 1
                print(f"       ✅  Added alternative: {alt_data['name']}")

        print("\n🗺   Seeding BRC centers...")
        for brc_data in BRCS:
            # Check by name to avoid duplicates
            existing = await prisma.bioresourcecenter.find_first(
                where={"name": brc_data["name"]}
            )
            if existing:
                print(f"  ⏭  {brc_data['name']} already exists — skipping")
                continue
            await prisma.bioresourcecenter.create(data=brc_data)
            brc_count += 1
            print(f"  ✅  Created BRC: {brc_data['name']}")

        print(f"\n🎉  Done! Seeded {chem_count} chemicals, {alt_count} alternatives, {brc_count} BRC centers.")
        if chem_count == 0 and brc_count == 0:
            print("     (All records already existed — nothing to insert.)")

    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())
