@echo off
git status --porcelain > temp_git_status.txt
for %%A in (temp_git_status.txt) do (
    set /a size=%%~zA
)

if %size%==0 (
    echo 🔸 Nothing to commit.
    del temp_git_status.txt
    pause
    exit /b
)

del temp_git_status.txt
set /p commit_msg="Enter commit message: "
git add .
git commit -m "%commit_msg%"
git push
pause
