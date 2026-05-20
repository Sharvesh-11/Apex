import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import oauth

from app.routers import attendance, auth, gallery, google_oauth, members, payment, plan, subscription


app = FastAPI()



# Ensure the static/gallery directory exists on startup
@app.on_event("startup")
def _ensure_static_dirs():
	os.makedirs("static/gallery", exist_ok=True)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000", "*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# Include routers (all with prefix "/api")
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(members.router, prefix="/api/members", tags=["members"])
app.include_router(google_oauth.router, prefix="/api/auth", tags=["auth"])
app.include_router(plan.router, prefix="/api/plans", tags=["plans"])
app.include_router(subscription.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(payment.router, prefix="/api/payments", tags=["payments"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(gallery.router, prefix="/api/gallery", tags=["gallery"])
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(oauth.router, prefix="/api/oauth", tags=["oauth"])


@app.get("/")
def root():
	return {"message": "Apex API is running"}