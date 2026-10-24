param([string]$Path='reports/Bao_cao_Trien_khai_Theo_mau_dtc245200223.docx')
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$taskInput=(Resolve-Path -LiteralPath $Path).Path
$taskQa=Join-Path (Get-Location) 'tmp/report-v2'
New-Item -ItemType Directory -Path $taskQa -Force | Out-Null
$taskWord=New-Object -ComObject Word.Application
$taskWord.Visible=$false
$taskWord.DisplayAlerts=0
try {
  $taskDoc=$taskWord.Documents.Open($taskInput)
  for($taskCycle=0;$taskCycle -lt 3;$taskCycle++){
    $taskDoc.Fields.Update() | Out-Null
    for($taskIndex=1;$taskIndex -le $taskDoc.TablesOfContents.Count;$taskIndex++){
      $taskDoc.TablesOfContents.Item($taskIndex).Update()
    }
    for($taskIndex=1;$taskIndex -le $taskDoc.TablesOfFigures.Count;$taskIndex++){
      $taskDoc.TablesOfFigures.Item($taskIndex).Update()
    }
    $taskDoc.Repaginate()
  }
  $taskDoc.Save()
  $taskDoc.ExportAsFixedFormat((Join-Path $taskQa 'report.pdf'),17)
  Write-Output ('Pages='+$taskDoc.ComputeStatistics(2)+' TOCs='+$taskDoc.TablesOfContents.Count+' FigureLists='+$taskDoc.TablesOfFigures.Count)
  $taskDoc.Close(0)
} finally {$taskWord.Quit()}
