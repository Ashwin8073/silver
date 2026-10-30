$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$trackerPath = Join-Path $PSScriptRoot "tracker.json"

Set-Location $projectRoot

$reportFile = Join-Path (
  [System.IO.Path]::GetTempPath()
) ("dgp-vitest-" + [guid]::NewGuid().ToString("N") + ".json")

try {
    Write-Host "`n===== RUNNING ACTUAL VITEST SUITE =====" -ForegroundColor Cyan

    & npm.cmd test -- --reporter=json --outputFile="$reportFile"

    $exitCode = $LASTEXITCODE

    if (-not (Test-Path -LiteralPath $reportFile)) {
        throw "Vitest JSON report was not generated."
    }

    $report = Get-Content -LiteralPath $reportFile -Raw |
        ConvertFrom-Json

    $passed = [int]$report.numPassedTests
    $failed = [int]$report.numFailedTests
    $total = [int]$report.numTotalTests

    if ($exitCode -ne 0 -or $failed -gt 0) {
        Write-Host "Tests failed. Tracker will not mark this run as passing." -ForegroundColor Red
        throw "Vitest reported test failures."
    }

    if ($passed -ne $total) {
        throw "Test count mismatch. Tracker not updated."
    }

    $tracker = Get-Content -LiteralPath $trackerPath -Raw |
        ConvertFrom-Json

    $tracker.test_results.passed = $passed
    $tracker.test_results.failed = $failed
    $tracker.test_results.test_files = @($report.testResults).Count

    $tracker |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath $trackerPath -Encoding utf8

    Write-Host "`n===== TRACKER SYNCHRONIZED =====" -ForegroundColor Green
    Write-Host "Passed:     $passed"
    Write-Host "Failed:     $failed"
    Write-Host "Test files: $(@($report.testResults).Count)"

} finally {
    if (Test-Path -LiteralPath $reportFile) {
        Remove-Item -LiteralPath $reportFile -Force
    }
}
