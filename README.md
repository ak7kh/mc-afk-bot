# 🎮 Minecraft Bedrock AFK Bot (24/7) with Telegram Controller

بوت ماين كرافت بدروك (Bedrock Edition) متصل بتيليجرام لمنع الطرد (Anti-AFK) مع ميزات:
- خادم ويب مدمج لاستقبال طلبات الـ Ping ومنع النوم على الاستضافات المجانية.
- حفظ الإحداثيات ومنع الطرد بسبب إحداثيات (0, 0, 0).
- إعادة اتصال تلقائية (Auto-Reconnect) عند تقطع السيرفر.
- أمر `/setserver` لتغيير بورت Aternos المتغير مباشرة من التيليجرام.

## 🚀 طريقة التثبيت والتشغيل السريع

### 1. المتطلبات
- تثبيت Node.js (إصدار 18 أو أحدث).

### 2. تثبيت الحزم
```bash
npm install
```

### 3. إعداد ملف .env
انسخ الملف `.env.example` إلى `.env` وضع التوكن الخاص بك:
```env
TELEGRAM_TOKEN=your_telegram_bot_token_here
MC_SERVER_IP=sweet_couple.aternos.me
MC_SERVER_PORT=41806
BOT_USERNAME=AK7_Bot
```

### 4. التشغيل
```bash
npm start
```

## 🌐 لمنع النوم على Back4app أو Render
1. احصل على رابط التطبيق العام (مثلاً `https://my-bot.b4a.run`).
2. سجّل في [UptimeRobot](https://uptimerobot.com) أو [Cron-Job.org](https://cron-job.org).
3. اضبط فحص HTTP لرابط `https://my-bot.b4a.run/ping` كل 5 دقائق.
