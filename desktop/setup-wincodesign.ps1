$ErrorActionPreference = "Stop"

$CacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
$Version = "2.6.0"
$Url = "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-$Version/winCodeSign-$Version.7z"
$SevenZip = "$PWD\node_modules\7zip-bin\win\x64\7za.exe"

# Ensure cache directory exists
if (!(Test-Path $CacheDir)) {
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
}

$DestDir = "$CacheDir\$Version" # Correctly extract to version folder which electron-builder expects (or check if it expects the inside content directly)
# Based on logs: Extracting archive: ...\056270003.7z ...
# It seems electron-builder downloads to a temp file, then extracts to a folder.
# Let's try to extract to the expected folder structure. 
# The error was "Cannot create symbolic link".
# We will download the file, and extract it using 7za but ignoring errors if possible, or just extracting what we can.

$DownloadPath = "$CacheDir\winCodeSign-$Version.7z"

Write-Host "Downloading winCodeSign tools..."
Invoke-WebRequest -Uri $Url -OutFile $DownloadPath

Write-Host "Extracting..."
# Create destination directory
if (!(Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

# Use 7za to extract. -y to assume yes, -o to output dir.
# We CANNOT easily tell 7za to ignore symlink errors and continue, but typically it extracts files first.
# The symlinks on windows are often not needed for the build (they are for mac/linux usually within the package).
# Let's try to extract. If it fails, we catch it, but assume the files we need (windows binaries) are there.
try {
    & $SevenZip x "$DownloadPath" "-o$DestDir" -y
}
catch {
    Write-Warning "Extraction had errors (likely symlinks), checking if critical files exist..."
}

# Verify if typical files exist
if (Test-Path "$DestDir\winCodeSign\rcedit.exe") {
    Write-Host "Success: rcedit.exe found."
} elseif (Test-Path "$DestDir\rcedit.exe") {
     Write-Host "Success: rcedit.exe found (release root)."
} else {
    Write-Warning "Could not find rcedit.exe. Extraction might have failed completely."
}

Write-Host "Done."
