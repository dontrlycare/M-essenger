@echo off
chcp 65001 > nul
echo ==========================================
echo      M-essenger Android Build Script
echo ==========================================

:: 1. Set JAVA_HOME (Standard Android Studio JBR path)
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
echo [INFO] JAVA_HOME set to: "%JAVA_HOME%"

:: 2. Prepare Assets (Windows Compatible)
echo [INFO] Preparing www directory...
if exist www rmdir /s /q www
mkdir www
copy index.html www\
copy mobile.css www\
copy icon.png www\
xcopy /E /I /Y desktop www\desktop

echo [INFO] Syncing Capacitor...
call npx cap sync android

:: 2.1 Create local.properties
echo [INFO] Updating local.properties...
echo sdk.dir=C:/Users/анальный потрошитель/AppData/Local/Android/Sdk > android\local.properties

:: 2.5 Accept Licenses
echo [INFO] Looking for sdkmanager...
:: 2.5 Accept Licenses (Manual Method - bypasses sdkmanager)
echo [INFO] Manually accepting licenses...
set "LICENSE_DIR=C:\Users\анальный потрошитель\AppData\Local\Android\Sdk\licenses"
if not exist "%LICENSE_DIR%" mkdir "%LICENSE_DIR%"

echo 8933bad161af4178b1185d1a37fbf41ea5269c55 > "%LICENSE_DIR%\android-sdk-license"
echo d56f5187479451eabf01fb78af6dfcb131a6481e >> "%LICENSE_DIR%\android-sdk-license"
echo 24333f8a63b6825ea9c5514f83c2829b004d1fee >> "%LICENSE_DIR%\android-sdk-license"

echo 84831b9409646a918e30573bab4c9c91346d8abd > "%LICENSE_DIR%\android-sdk-preview-license"

echo [INFO] Licenses written manually.

:: 3. Clean Gradle Cache (Optional but recommended for fixing your specific error)
echo [INFO] Cleaning project...
cd android
call gradlew.bat clean

:: 4. Build Debug APK
echo [INFO] Building APK...
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo [SUCCESS] APK Built Successfully!
    echo Location: android\app\build\outputs\apk\debug\app-debug.apk
    echo ==========================================
    explorer "app\build\outputs\apk\debug"
) else (
    echo.
    echo ==========================================
    echo [ERROR] Build Failed. See logs above.
    echo ==========================================
)
pause
