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
Remove-Item -Recurse -Force "src/vs/base"

# Copy base
Write-Host "`e[32m> Copying base`e[0m"
Copy-Item -Path "src/vs/temp/src/vs/base" -Destination "src/vs/base" -Recurse

# Comment out any CSS imports
Write-Host "`e[32m> Commenting out CSS imports`e[0m"
$baseFiles = Get-ChildItem -Path "src/vs/base" -Recurse -File
$count = 0
foreach ($file in $baseFiles) {
  $content = Get-Content -Path $file.FullName
  $updatedContent = $content | ForEach-Object {
    #               import 'vs/css!./actionbar';
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
Write-Host " $count files patched"
