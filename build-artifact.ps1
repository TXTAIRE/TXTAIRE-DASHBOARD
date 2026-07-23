# Bundles the multi-file app (index.html + css/ + js/ + assets/logo.svg) into a single
# self-contained HTML file for publishing (e.g. as a Claude Artifact).
#
# The multi-file source under css/, js/, index.html remains the real codebase to keep
# editing day to day. Run this script after making changes, then republish dist/bundle.html
# to update the live page.
#
# Usage: powershell -ExecutionPolicy Bypass -File build-artifact.ps1

$root = $PSScriptRoot
$distDir = Join-Path $root "dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }
$outPath = Join-Path $distDir "bundle.html"

function ReadFile($relPath) {
  return Get-Content -Raw -Encoding UTF8 (Join-Path $root $relPath)
}

$css = ReadFile "css/styles.css"
$logoSvg = ReadFile "assets/logo.svg"
# Drop the xml/svg root open+close so it can be re-wrapped with a class attribute inline
$logoInner = $logoSvg -replace '(?s)^.*?<svg[^>]*>', '' -replace '</svg>\s*$', ''

$jsFiles = @(
  "js/store.js",
  "js/app.js",
  "js/views/overview.js",
  "js/views/staff.js",
  "js/views/recruitment.js",
  "js/views/probation.js",
  "js/views/disciplinary.js",
  "js/views/attendance.js",
  "js/views/payroll.js",
  "js/views/complaints.js"
)

$scripts = ($jsFiles | ForEach-Object {
  $name = $_
  $code = ReadFile $name
  "<script>`n/* ================= $name ================= */`n$code`n</script>"
}) -join "`n`n"

# app.js normally wires up nav clicks + initial render() inside a DOMContentLoaded listener.
# In the bundled single-file artifact the script runs after the DOM already exists (it's
# placed at the end of the body), so swap that listener for an immediately-invoked function
# so navigation and first paint both work without waiting on an event that already fired.
$scripts = $scripts -replace [regex]::Escape("document.addEventListener('DOMContentLoaded', function () {"), "(function () {"
$scripts = $scripts -replace '(?m)^\}\);$', '})();'

$html = @"
<title>TxTAIRE HQ &middot; HR &amp; Operations</title>
<style>
$css
</style>
<div id="app">
  <aside class="sidebar">
    <div class="brand">
      <svg class="brand-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 190">
$logoInner
      </svg>
    </div>

    <nav id="sidebar-nav">
      <div class="nav-group">
        <div class="nav-label">General</div>
        <a class="nav-item" data-route="overview"><span class="ic">&#9635;</span> <span>Overview</span></a>
      </div>
      <div class="nav-group">
        <div class="nav-label">HR</div>
        <a class="nav-item" data-route="staff"><span class="ic">&#128100;</span> <span>Employees</span></a>
        <a class="nav-item" data-route="recruitment"><span class="ic">&#128203;</span> <span>Recruitment</span></a>
        <a class="nav-item" data-route="probation"><span class="ic">&#128197;</span> <span>Probation / Regularization</span></a>
        <a class="nav-item" data-route="disciplinary"><span class="ic">&#9888;</span> <span>Disciplinary / NTE</span></a>
        <a class="nav-item" data-route="attendance"><span class="ic">&#128197;</span> <span>Attendance</span></a>
        <a class="nav-item" data-route="payroll"><span class="ic">&#128179;</span> <span>Payroll</span></a>
      </div>
      <div class="nav-group">
        <div class="nav-label">Records</div>
        <a class="nav-item" data-route="complaints"><span class="ic">&#128172;</span> <span>Complaints</span></a>
      </div>
    </nav>

    <div class="sidebar-foot">
      <div class="avatar-chip">HR</div>
      <div>
        <div style="color:var(--text); font-weight:600;">HR Admin</div>
        <div style="font-size:11px;">TxTAIRE HQ</div>
      </div>
    </div>
  </aside>

  <main class="main" id="main-content"></main>
</div>

$scripts
"@

Set-Content -Path $outPath -Value $html -Encoding UTF8
Write-Host "Built $outPath"
