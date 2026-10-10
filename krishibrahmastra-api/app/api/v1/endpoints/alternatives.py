import os
from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import get_current_user
from app.db.client import prisma
import redis
import json
import logging
from app.core.config import settings
from google import genai
from google.genai import types

router = APIRouter()
cache = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def generate_ai_alternatives(chemical_name: str) -> dict:
    if not genai_client:
        return None
    
    prompt = f"""
    You are an expert agronomist. The farmer has identified the chemical '{chemical_name}'.
    Provide organic or bio-based alternatives for this chemical.
    Return ONLY a JSON object with this exact structure:
    {{
        "chemical": "{chemical_name}",
        "category": "Insecticide/Fungicide/Herbicide",
        "alternatives": [
            {{
                "name": "Alternative Name (e.g. Neem Oil)",
                "type": "Botanical/Microbial/Mineral",
                "preparationSteps": ["Step 1 with specific quantity", "Step 2"],
                "pros": ["Pro 1", "Pro 2"],
                "cons": ["Con 1"],
                "efficacyRating": 4.5
            }}
        ]
    }}
    Provide 1 to 3 high-quality alternatives. Ensure preparationSteps include specific local quantities.
    """
    try:
        response = genai_client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Gemini API error generating alternatives for {chemical_name}: {e}")
        return None

@router.get("/alternatives/{chemical_name}")
async def get_alternatives(chemical_name: str, current_user=Depends(get_current_user)):
    cache_key = f"alternatives:{chemical_name.upper()}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    chemical = await prisma.chemical.find_unique(
        where={"name": chemical_name.upper()},
        include={"alternatives": True}
    )
    
    result = None
    if chemical and chemical.alternatives:
        result = {
            "chemical": chemical.name,
            "category": chemical.category,
            "alternatives": [
                {
                    "name": alt.name,
                    "type": alt.type,
                    "preparationSteps": alt.preparationSteps,
                    "pros": alt.pros,
                    "cons": alt.cons,
                    "efficacyRating": alt.efficacyRating,
                }
                for alt in chemical.alternatives
            ],
        }
    else:
        # Fallback to AI generation
        ai_result = generate_ai_alternatives(chemical_name)
        if ai_result:
            result = ai_result
        else:
            raise HTTPException(404, f"No bio-alternatives found for {chemical_name} and AI fallback failed.")

    cache.setex(cache_key, 3600, json.dumps(result))  # Cache for 1 hour
    return result

