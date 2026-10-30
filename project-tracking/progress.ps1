$ErrorActionPreference = "Stop"

$trackerPath = Join-Path $PSScriptRoot "tracker.json"

$tracker = Get-Content $trackerPath -Raw |
    ConvertFrom-Json

$features = @($tracker.features)

$done = @($features | Where-Object status -eq "DONE").Count
$active = @($features | Where-Object status -eq "IN_PROGRESS").Count
$pending = @($features | Where-Object status -eq "PENDING").Count
$blocked = @($features | Where-Object status -eq "BLOCKED").Count

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " D-GATE PLATFORM API - PROGRESS"
Write-Host "======================================" -ForegroundColor Cyan

Write-Host "Project:       $($tracker.code)"
Write-Host "Current step:  $($tracker.current_step)"
Write-Host "Last complete: $($tracker.last_completed_step)"
Write-Host "Tests passed:  $($tracker.test_results.passed)"
Write-Host "Tests failed:  $($tracker.test_results.failed)"

Write-Host ""
Write-Host "BASELINE FEATURE STATUS" -ForegroundColor Cyan

Write-Host "Total tracked: $($features.Count)"
Write-Host "Done:          $done" -ForegroundColor Green
Write-Host "In progress:   $active" -ForegroundColor Yellow
Write-Host "Pending:       $pending"
Write-Host "Blocked:       $blocked" -ForegroundColor Red

Write-Host ""
Write-Host "CURRENT WORK" -ForegroundColor Cyan

$features |
    Where-Object status -eq "IN_PROGRESS" |
    Select-Object id, title, verification |
    Format-Table -AutoSize

Write-Host "BUG REGISTER" -ForegroundColor Cyan

Write-Host "Total bugs: $(@($tracker.bugs).Count)"
Write-Host "Open bugs:  $(@($tracker.bugs | Where-Object status -ne 'DONE').Count)"

Write-Host ""
Write-Host "NEW CONCEPT REGISTER" -ForegroundColor Cyan
Write-Host "Concepts: $(@($tracker.concepts).Count)"

Write-Host ""
Write-Host "Note: Overall project percentage is not yet baselined."
Write-Host "======================================"
