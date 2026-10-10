import os
import io
import json
import logging
from PIL import Image
from google import genai
from google.genai import types
from fastapi import UploadFile

logger = logging.getLogger("ocr_service")

GEMINI_PROMPT = """
Analyze this agrochemical bottle label. 
Identify the primary active chemical ingredient (e.g., IMIDACLOPRID, CYPERMETHRIN, CHLORPYRIFOS).
Return ONLY a JSON object with the following structure:
{
    "matched_chemical": "NAME_OF_CHEMICAL",
    "confidence": 0.95,
    "raw_text": "all the raw text you could read from the label"
}
If you cannot identify any chemical, set matched_chemical to "UNKNOWN" and confidence to 0.0.
"""

class AgrochemicalOCRService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("GEMINI_API_KEY not set. OCR will fail if called.")
            self.client = None

    async def run_ocr(self, file: UploadFile) -> dict:
        if not self.client:
            raise ValueError("Gemini API key is not configured.")
            
        content = await file.read()
        
        if len(content) > 10 * 1024 * 1024:
            raise ValueError("Image too large. Maximum size is 10MB.")

        try:
            img = Image.open(io.BytesIO(content))
        except Exception as e:
            raise ValueError(f"Could not decode image: {e}")

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-pro',
                contents=[GEMINI_PROMPT, img],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()
            result = json.loads(raw_text)
            logger.info(f"Gemini OCR result: {result}")
            
            return {
                "matched_chemical": result.get("matched_chemical", "UNKNOWN").upper(),
                "confidence": float(result.get("confidence", 0.0)),
                "raw_text": result.get("raw_text", ""),
            }
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise Exception(f"OCR processing failed: {str(e)}")

ocr_service = AgrochemicalOCRService()
