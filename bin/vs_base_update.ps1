# Get latest vscode repo
if (Test-Path -Path "src/vs/temp") {
  Write-Host "`e[32m> Fetching latest`e[0m"
  git -C src/vs/temp checkout
  git -C src/vs/temp pull
} else {
  Write-Host "`e[32m> Cloning microsoft/vscode`e[0m"
  $null = New-Item -ItemType Directory -Path "src/vs/temp" -Force
  git clone https://github.com/microsoft/vscode src/vs/temp
}

# Delete old base
Write-Host "`e[32m> Deleting old base`e[0m"
$null = Remove-Item -Recurse -Force "src/vs/base"

# Copy base
Write-Host "`e[32m> Copying base`e[0m"
Copy-Item -Path "src/vs/temp/src/vs/base" -Destination "src/vs/base" -Recurse

# Comment out any CSS imports
Write-Host "`e[32m> Commenting out CSS imports" -NoNewline
$baseFiles = Get-ChildItem -Path "src/vs/base" -Recurse -File
$count = 0
foreach ($file in $baseFiles) {
  $content = Get-Content -Path $file.FullName
  $updatedContent = $content | ForEach-Object {
    if ($_ -match "^import 'vs/css!") {
      Write-Host "`e[32m." -NoNewline
      $count++
      "// $_"
    } else {
      $_
    }
  }
  $updatedContent | Set-Content -Path $file.FullName
}
Write-Host " $count files patched`e[0m"

# Replace `monaco-*` with `xterm-*`, this will help avoid any styling conflicts when monaco and
# xterm.js are used in the same project.
Write-Host "`e[32m> Replacing monaco-* class names with xterm-* `e[0m" -NoNewline
$baseFiles = Get-ChildItem -Path "src/vs/base" -Recurse -File
$count = 0
foreach ($file in $baseFiles) {
  $content = Get-Content -Path $file.FullName
  if ($content -match "monaco-([a-zA-Z\-]+)") {
    $updatedContent = $content -replace "monaco-([a-zA-Z\-]+)", 'xterm-$1'
    Write-Host "`e[32m." -NoNewline
    $count++
    $updatedContent | Set-Content -Path $file.FullName
  }
}
Write-Host " $count files patched`e[0m"

# Copy typings
Write-Host "`e[32m> Copying typings`e[0m"
Copy-Item -Path "src/vs/temp/src/typings" -Destination "src/vs" -Recurse -Force

# Deleting unwanted typings
Write-Host "`e[32m> Deleting unwanted typings`e[0m"
$null = Remove-Item -Path "src/vs/typings/vscode-globals-modules.d.ts" -Force
