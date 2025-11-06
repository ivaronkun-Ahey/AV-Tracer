from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.engine import SimulationEngine

app = FastAPI(
    title="AV-Tracer API",
    description="API for AV-Tracer - Audio-Video System Simulator",
    version="1.0.0",
)

# CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class SimulationRequest(BaseModel):
    devices: List[Dict[str, Any]]
    connections: List[Dict[str, Any]]

# Routes
@app.get("/")
def root():
    return {
        "message": "AV-Tracer API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/simulate")
async def simulate_system(request: SimulationRequest):
    """
    Simulate an AV system topology
    """
    try:
        engine = SimulationEngine()
        engine.load_topology(request.devices, request.connections)
        result = engine.run_simulation()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
