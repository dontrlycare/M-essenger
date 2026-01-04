@echo off
chcp 65001
echo ==============================================
echo   АВТОМАТИЧЕСКАЯ ЗАГРУЗКА НА GITHUB
echo ==============================================
echo.

set /p repo_url="Вставьте ссылку на ваш репозиторий (например https://github.com/user/repo.git): "

if "%repo_url%"=="" (
    echo Ссылка не может быть пустой!
    pause
    exit /b
)

echo.
echo Инициализация...
git init

echo.
echo Добавление файлов...
git add .

echo.
echo Сохранение версии...
git commit -m "Auto-update from script"

echo.
echo Настройка ветки...
git branch -M main

echo.
echo Привязка репозитория...
git remote remove origin 2>nul
git remote add origin %repo_url%

echo.
echo Отправка файлов...
echo (Может потребоваться войти в аккаунт GitHub в браузере)
git push -u origin main --force

echo.
echo ==============================================
if %errorlevel% neq 0 (
    echo ОШИБКА! Что-то пошло не так. Читайте текст выше.
) else (
    echo УСПЕШНО! Проект загружен.
)
echo ==============================================
pause
