$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $repoRoot 'dist'
$installer = Get-ChildItem -LiteralPath $distRoot -File -Filter '*setup.exe' | Select-Object -First 1
if (-not $installer) {
  throw "Windows setup installer not found in $distRoot"
}

$tempBase = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
if (-not $tempBase) {
  throw 'RUNNER_TEMP or TEMP must be set'
}
$resolvedTempBase = [IO.Path]::GetFullPath($tempBase)
$tempPrefix = $resolvedTempBase.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$installRoot = [IO.Path]::GetFullPath((Join-Path $resolvedTempBase ('isyco-worlds-installer-smoke-' + [guid]::NewGuid().ToString('N'))))
if (-not $installRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to install outside the runner temp directory: $installRoot"
}
New-Item -ItemType Directory -Path $installRoot | Out-Null

try {
  $installProcess = Start-Process -FilePath $installer.FullName -ArgumentList @('/S', "/D=$installRoot") -PassThru -WindowStyle Hidden
  if (-not $installProcess.WaitForExit(180000)) {
    Stop-Process -Id $installProcess.Id -Force -ErrorAction SilentlyContinue
    throw 'Windows setup installer exceeded 180 seconds'
  }
  $installProcess.Refresh()
  if ($installProcess.ExitCode -ne 0) {
    throw "Windows setup installer exited $($installProcess.ExitCode)"
  }

  $installedApp = Join-Path $installRoot 'ISyCo Worlds.exe'
  if (-not (Test-Path -LiteralPath $installedApp -PathType Leaf)) {
    throw "Installed app executable not found: $installedApp"
  }

  & node (Join-Path $repoRoot 'scripts/smoke-release-app.cjs') win --executable $installedApp
  if ($LASTEXITCODE -ne 0) {
    throw "Installed app health smoke exited $LASTEXITCODE"
  }
  Write-Output 'Windows NSIS setup install and installed-app health smoke passed.'
} finally {
  $uninstaller = Get-ChildItem -LiteralPath $installRoot -File -Filter '*uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($uninstaller) {
    $uninstallProcess = Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S') -PassThru -WindowStyle Hidden
    if (-not $uninstallProcess.WaitForExit(90000)) {
      Stop-Process -Id $uninstallProcess.Id -Force -ErrorAction SilentlyContinue
      Write-Warning 'Windows smoke uninstaller exceeded 90 seconds; removing its isolated temp directory.'
    } else {
      $uninstallProcess.Refresh()
      if ($uninstallProcess.ExitCode -ne 0) {
        Write-Warning "Windows smoke uninstaller exited $($uninstallProcess.ExitCode); removing its isolated temp directory."
      }
    }
  }

  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    try {
      Remove-Item -LiteralPath $installRoot -Recurse -Force -ErrorAction Stop
      break
    } catch {
      if ($attempt -eq 24) { throw }
      Start-Sleep -Milliseconds 200
    }
  }
}
