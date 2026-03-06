# Telegram Movie Bot 🎬

Ushbu bot kinolarni nomi yoki kodi orqali qidirish imkonini beradi. Admin panel orqali kinolarni qo'shish va o'chirish mumkin.

## O'rnatish va Ishga Tushirish

1. **Bot Tokenini olish**: [@BotFather](https://t.me/BotFather) orqali yangi bot yarating.
2. **Kanal IDsini olish**: Bot a'zo bo'ladigan kanalning IDsini (masalan: `@sizning_kanalingiz`) oling.
3. **.env faylini sozlash**: `.env` faylini oching va quyidagilarni kiriting:
   - `BOT_TOKEN`: Sizning bot tokeningiz.
   - `CHANNEL_ID`: Kanal manzili (masalan: `@kino_olami`).
   - `ADMIN_IDS`: Sizning Telegram IDingiz ( [@userinfobot](https://t.me/userinfobot) orqali bilish mumkin).
4. **Kutubxonalarni o'rnatish** (agar hali o'rnatilmagan bo'lsa):
   ```bash
   npm install
   ```
5. **Botni ishga tushirish**:
   ```bash
   npm start
   ```

## Xususiyatlar

- 🔍 **Qidiruv**: Kino kodi (masalan: 101) yoki nomi orqali.
- 📺 **Majburiy obuna**: Foydalanuvchi kanalga a'zo bo'lmasa, botdan foydalana olmaydi.
- 🎲 **Tasodifiy kino**: Tasodifiy birorta kinoni tavsiya qilish.
- 🛠 **Admin Panel**:
  - Kinolarni video fayl shaklida qo'shish.
  - Kod orqali o'chirish.
  - Statistika.
  - Barcha foydalanuvchilarga reklama tarqatish.

## 24/7 Tekinga Ishga Tushirish (Render.com)

1. Kodni **GitHub**ga yuklang.
2. [Render.com](https://render.com) da "Web Service" oching.
3. GitHub repongizni ulang.
4. **Environment Variables** bo'limiga `.env` dagi barcha ma'lumotlarni kiriting.
5. **Muhim**: Render "Free tier" 15 daqiqa harakatsizlikdan so'ng uxlab qoladi.
6. Uni doimo uyg'oq saqlash uchun [cron-job.org](https://cron-job.org) dan ro'yxatdan o'ting va Render bergan URL manzilini (masalan: `https://bot-nomi.onrender.com`) har 5 daqiqada "ping" qiladigan qilib sozlang.

> [!WARNING]
> Render Free tierda fayllar (sqlite bazasi) bot o'chib yonganda o'chib ketishi mumkin. Doimiy baza uchun MongoDB yoki Supabase kabi tashqi bepul bazalardan foydalanish tavsiya etiladi.
