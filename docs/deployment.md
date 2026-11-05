# Deployment

## Vercel unified demo

From repository root run `npm ci`, `npm run build`, then `vercel --prod`. Select the Next.js framework and leave the root directory as the repository root. The Python function at api/index.py imports backend.app.main. Requirements are installed from the root requirements.txt. The supplied rewrite sends /api/* to the FastAPI handler while preserving the request path.

Without DATABASE_URL this is a temporary synthetic demonstration: Vercel /tmp storage is ephemeral and isolated per instance. A stable JWT_SECRET alone does not make SQLite storage durable. Configure managed PostgreSQL for consistent shared data and authentication.

For durable synthetic demonstration set DATABASE_URL to a PostgreSQL URL, JWT_SECRET to a random 48-byte secret, and DEMO_MODE=true. Public seeded credentials remain intentional in demo mode.

For non-demo startup use a fresh database, DEMO_MODE=false, stable JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters), and exact CORS_ORIGINS. Never upload real patient data. HTTPS is supplied by Vercel. At-rest encryption depends on the chosen database host. Secrets belong in Vercel environment variables, never NEXT_PUBLIC_* variables or Git.

## Render / Railway backend alternative

Use repository root, build command `pip install -r requirements.txt`, start command `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`. Set DATABASE_URL, JWT_SECRET, DEMO_MODE, and CORS_ORIGINS to the deployed frontend URL. No paid API is required. Free hosting availability and quotas vary; local Docker is the no-subscription alternative.

For separate backend hosting set API_URL in the Next.js build environment and replace the Vercel API rewrite destination with the HTTPS backend URL followed by /api/:path*. Remove the Python function from that frontend deployment if unnecessary. Keep requests same-origin via this rewrite so HttpOnly authentication works without cross-domain cookie handling.

## Local Docker

`docker compose up --build` starts PostgreSQL, the Python API, and Next.js. Access http://localhost:3000 and http://localhost:8000/docs. PostgreSQL stores data in a named volume. Change the example database password before any externally reachable use.
