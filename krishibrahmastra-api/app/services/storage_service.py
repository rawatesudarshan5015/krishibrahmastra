import boto3
from botocore.exceptions import NoCredentialsError
from fastapi import UploadFile
import uuid
import os
from app.core.config import settings

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.getenv('S3_ENDPOINT_URL', 'http://minio:9000'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID', 'minioadmin'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY', 'minioadmin'),
        region_name=os.getenv('S3_REGION', 'ap-south-1')
    )

async def upload_image(image_bytes: bytes, filename: str, content_type: str) -> str:
    s3_client = get_s3_client()
    bucket_name = os.getenv('S3_BUCKET', 'bioinput-scans')
    
    # Generate unique key
    ext = filename.split('.')[-1] if '.' in filename else 'jpg'
    unique_key = f"scans/{uuid.uuid4()}.{ext}"
    
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=unique_key,
            Body=image_bytes,
            ContentType=content_type
        )
        return unique_key
    except NoCredentialsError:
        raise Exception("S3/Minio credentials not found")
    except Exception as e:
        raise Exception(f"Failed to upload to S3: {str(e)}")

def get_image_url(key: str) -> str:
    bucket_name = os.getenv('S3_BUCKET', 'bioinput-scans')
    endpoint = os.getenv('S3_PUBLIC_ENDPOINT_URL') or os.getenv('S3_ENDPOINT_URL', 'http://minio:9000')
    return f"{endpoint}/{bucket_name}/{key}"
