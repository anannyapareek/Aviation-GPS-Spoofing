from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, JSON, DateTime, Enum, TIMESTAMP, text, Float
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class AviationPacket(BaseModel):
    icao24: str
    callsign: Optional[str] = None
    timestamp: int
    lat: Optional[float] = None
    lon: Optional[float] = None
    baro_alt: Optional[float] = None
    geo_alt: Optional[float] = None
    velocity: Optional[float] = None
    heading: Optional[float] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    source: str = "FlightRadar24"
    mitre_technique: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()

class RawIngest(Base):
    __tablename__ = "Raw_Ingest"

    id = Column(Integer, primary_key=True, autoincrement=True)
    icao24 = Column(String(20), index=True)
    callsign = Column(String(20), nullable=True)
    payload = Column(JSON, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    source = Column(String(20), default="OpenSky")
    inserted_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('Observer', 'Analyst', 'Admin'), default='Observer')

class HashedPacketResponse(BaseModel):
    id: int
    icao24: str
    callsign: Optional[str]
    payload: Dict[str, Any]
    sha256_hash: str
    source: str
    inserted_at: datetime

    class Config:
        from_attributes = True

class ForensicLog(Base):
    __tablename__ = "forensic_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    icao24 = Column(String(20))
    latitude = Column(Float)
    longitude = Column(Float)
    timestamp = Column(DateTime) # Using DateTime for consistency in Python side, though SQL has BIGINT/TIMESTAMP
    mitre_technique = Column(String(50))
    description = Column(String(255))
    forensic_hash = Column(String(64), nullable=False)
    inserted_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    
