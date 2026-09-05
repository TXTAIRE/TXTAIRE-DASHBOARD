param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'
$In = (Resolve-Path $In).Path
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($In, $false, $true)
  # 17 = wdExportFormatPDF
  $doc.ExportAsFixedFormat($Out, 17, $false, 0, 0, 0, 0, 0, $true, $true, 0, $true, $true, $false)
  Write-Output "PAGES=$($doc.ComputeStatistics(2))"
  $doc.Close($false)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
Write-Output "OK $Out"
