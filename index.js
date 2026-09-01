const { Telegraf, Markup } = require('telegraf');
const bedrock = require('bedrock-protocol');
const http = require('http');

// ================= الإعدادات =================
const TELEGRAM_TOKEN = '8882158605:AAF_HVfk3p5eev3KueWkveVNYUPXLtRi88Y';
const MC_SERVER_IP = 'sweet_couple.aternos.me';
const MC_SERVER_PORT = 41806;
const BOT_USERNAME = 'AK7_Bot';
// =============================================

// استخدام منفذ ديناميكي تتطلبه Back4App
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
});
server.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

const bot = new Telegraf(TELEGRAM_TOKEN);
let mcClient = null;
let movementInterval = null;
let currentYaw = 0;

const startAntiAfkLoop = () => {
    if (movementInterval) clearInterval(movementInterval);
    movementInterval = setInterval(() => {
        if (!mcClient) return;
        try {
            currentYaw = (currentYaw + 45) % 360;
            mcClient.queue('player_auth_input', {
                pitch: 0, yaw: currentYaw,
                position: { x: 0, y: 0, z: 0 },
                move_vector: { x: 0, z: 0 },
                head_yaw: currentYaw, input_data: 0,
                input_mode: 'mouse', play_mode: 'normal',
                interaction_model: 'classic', tick: 0n
            });
        } catch (err) {}
    }, 45000);
};

const stopAntiAfkLoop = () => {
    if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
    }
};

const keyboard = Markup.keyboard([
    ['🟢 دخول السيرفر (Start)'],
    ['🔴 الخروج من السيرفر (Stop)']
]).resize();

bot.start((ctx) => {
    ctx.reply("أهلاً بك! استخدم الأزرار للتحكم:", keyboard);
});

bot.hears(['🟢 دخول السيرفر (Start)', '/start_afk'], (ctx) => {
    if (mcClient) return ctx.reply("⚠️ البوت متصل بالسيرفر بالفعل!");
    
    ctx.reply("⏳ جارٍ الاتصال بسيرفر ماين كرافت...");
    try {
        mcClient = bedrock.createClient({
            host: MC_SERVER_IP,
            port: MC_SERVER_PORT,
            username: BOT_USERNAME,
            offline: true 
        });

        mcClient.on('join', () => {
            ctx.reply("✅ تم دخول السيرفر بنجاح! تم تفعيل نظام منع الطرد.");
            startAntiAfkLoop();
        });

        mcClient.on('disconnect', () => {
            ctx.reply("❌ تم فصل البوت من السيرفر.");
            stopAntiAfkLoop();
            mcClient = null;
        });
    } catch (error) {
        ctx.reply(`حدث خطأ أثناء الاتصال: ${error.message}`);
        stopAntiAfkLoop();
        mcClient = null;
    }
});

bot.hears(['🔴 الخروج من السيرفر (Stop)', '/stop_afk'], (ctx) => {
    if (!mcClient) return ctx.reply("⚠️ البوت غير متصل بالسيرفر حالياً.");
    
    stopAntiAfkLoop();
    mcClient.disconnect();
    mcClient = null;
    ctx.reply("🛑 تم الخروج من السيرفر بنجاح.");
});

// اصطياد الأخطاء المخفية أثناء محاولة الاتصال بتيليجرام
bot.launch()
    .then(() => console.log("🤖 البوت يعمل الآن بكفاءة متصلاً بتيليجرام!"))
    .catch((err) => console.error("❌ خطأ قاتل أثناء تشغيل بوت تيليجرام:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
