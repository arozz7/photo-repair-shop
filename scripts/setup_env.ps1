$ErrorActionPreference = "Stop"

$ENGINE_DIR = Join-Path $PSScriptRoot "..\engine"
$VENV_DIR = Join-Path $ENGINE_DIR ".venv"
$REQ_FILE = Join-Path $ENGINE_DIR "requirements.txt"

Write-Host "Creating Python Core Engine virtual environment..."

if (-not (Test-Path $VENV_DIR)) {
    Write-Host "Initializing .venv in $VENV_DIR"
    python -m venv $VENV_DIR
} else {
    Write-Host "Virtual environment already exists."
}

$PIP_CMD = Join-Path $VENV_DIR "Scripts\pip.exe"
$PYTHON_CMD = Join-Path $VENV_DIR "Scripts\python.exe"

Write-Host "Upgrading pip..."
& $PYTHON_CMD -m pip install --upgrade pip

if (Test-Path $REQ_FILE) {
    Write-Host "Installing requirements..."
    & $PIP_CMD install -r $REQ_FILE
} else {
    Write-Warning "No requirements.txt found at $REQ_FILE"
}

Write-Host "Virtual environment setup complete."
