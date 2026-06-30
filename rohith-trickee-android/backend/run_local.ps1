$env:DATABASE_URL='sqlite:///./trickee.local.db'
$env:LEGACY_AUTH_ENABLED='true'
$env:ENVIRONMENT='development'
$env:DEMO_SEED='true'
$env:DEMO_ADMIN_PASSWORD='Trickee@2026'
$env:DEMO_FLEET_PASSWORD='Evify@2026'
$env:DEMO_DRIVER_PASSWORD='Driver@2026'
cd 'C:\Users\BhaviChasvi\Downloads\trickee-main\rohith-trickee-android\backend'
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
