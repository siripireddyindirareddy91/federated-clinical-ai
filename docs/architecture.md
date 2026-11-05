# System architecture

MediFed AI separates the Next.js UI, FastAPI authorization layer, SQLAlchemy storage, logical training nodes, and LangGraph orchestration. See the README architecture diagram and explicit deployment limitations. Modules fetch authenticated APIs; mutation controls always validate roles on the server. Shared metadata/aggregate model metrics are available to signed-in users, while private datasets and cases require a matching hospital_id or super administrator access.

The generic records table holds typed JSON research artifacts with UUID keys and indexed kind/hospital/time columns. The platform administrator is a trusted operator with cross-tenant access. This is application-level isolation, not physical or database row-level isolation.
