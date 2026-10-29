# Neon Metroidvania — نسخه اجرایی

- `game.html` — کد بازی (استخراج‌شده از فایل TextEdit)
- `main.go`, `native_*.go` — برنامه‌ای که بازی را داخل فایل اجرایی قرار می‌دهد
- `build.sh` — ساخت فایل‌های اجرایی در پوشه `../download/`

خروجی‌ها:
- `download/NeonMetroidvania.exe` — ویندوز ۱۰/۱۱ (در پنجره خودش باز می‌شود؛ اگر WebView2 نصب نباشد در مرورگر باز می‌شود)
- `download/NeonMetroidvania-mac.zip` — مک (Apple Silicon و Intel)؛ بازی در مرورگر پیش‌فرض باز می‌شود

برای ساخت دوباره (نیاز به Go 1.24 به بالا): `./build.sh`
