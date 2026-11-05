"""SQLAlchemy storage. All identifiers are UUIDs; tenant checks live in API dependencies."""
import os, uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc)
DEMO = os.getenv('DEMO_MODE', 'true').lower() == 'true'
url = os.getenv('DATABASE_URL') or ('sqlite:////tmp/medifed.db' if os.getenv('VERCEL') else 'sqlite:///./medifed.db')
if url.startswith('postgres://'): url = url.replace('postgres://','postgresql+psycopg://',1)
if url.startswith('postgresql://'): url = url.replace('postgresql://','postgresql+psycopg://',1)
engine = create_engine(url, connect_args={'check_same_thread':False, 'timeout':30} if url.startswith('sqlite') else {}, pool_pre_ping=True)
Session = sessionmaker(bind=engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
class Hospital(Base):
    __tablename__='hospitals'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uid)
    name: Mapped[str] = mapped_column(String(160))
    location: Mapped[str] = mapped_column(String(160))
    contact: Mapped[str] = mapped_column(String(200),default='research@example.org')
    institution_type: Mapped[str] = mapped_column(String(80),default='Research hospital')
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now)
class User(Base):
    __tablename__='users'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uid)
    email: Mapped[str] = mapped_column(String(254),unique=True,index=True)
    name: Mapped[str] = mapped_column(String(120))
    password: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(40),default='researcher')
    hospital_id: Mapped[str|None] = mapped_column(ForeignKey('hospitals.id'),nullable=True,index=True)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now)
class Record(Base):
    __tablename__='records'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uid)
    kind: Mapped[str] = mapped_column(String(50),index=True)
    hospital_id: Mapped[str|None] = mapped_column(ForeignKey('hospitals.id'),nullable=True,index=True)
    payload: Mapped[str] = mapped_column(Text,default='{}')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now,index=True)
class Setting(Base):
    __tablename__='settings'
    key: Mapped[str] = mapped_column(String(80),primary_key=True)
    value: Mapped[str] = mapped_column(Text)
Base.metadata.create_all(engine)
