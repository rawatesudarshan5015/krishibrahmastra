import asyncio
from app.db.client import prisma
import sys

async def main():
    if len(sys.argv) < 2:
        print("Usage: python make_admin.py <email>")
        sys.exit(1)

    email = sys.argv[1]

    await prisma.connect()
    try:
        user = await prisma.user.find_unique(where={"email": email})
        if not user:
            print(f"Error: User with email '{email}' not found.")
            sys.exit(1)

        await prisma.user.update(
            where={"email": email},
            data={"role": "ADMIN"}
        )
        print(f"Success: {user.name} ({email}) is now an ADMIN.")
    finally:
        await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
