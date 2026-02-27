# run-tests.ps1
# Runs all unit tests in the tests\ subdirectory using Mocha + Chai.
# Usage: .\run-tests.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "==> Installing dependencies (if needed)..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "==> Running unit tests..." -ForegroundColor Cyan
npm test

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Tests FAILED (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "All tests passed." -ForegroundColor Green
