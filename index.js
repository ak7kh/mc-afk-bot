const TelegramBot = require('node-telegram-bot-api');
const bedrock = require('bedrock-protocol');
const http = require('http');

// ================= الإعدادات =================
const TELEGRAM_TOKEN = '8882158605:AAF_HVfk3p5eev3KueWkveVNYUPXLtRi88Y';
const MC_SERVER_IP = 'sweet_couple.aternos.me';
const MC_SERVER_PORT = 41806;
const BOT_USERNAME = 'AK7_Bot';
// =============================================

// إعداد خادم ويب وهمي لمنصة الاستضافة
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running alive!');
});
server.listen(8080, () => {
    console.log('Web server is listening on port 8080');
});

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let mcClient = null;
let movementInterval = null;
let currentYaw = 0;

// دالة تدوير البوت وتحريكه لمنع الـ AFK
const startAntiAfkLoop = () => {
    if (movementInterval) clearInterval(movementInterval);

    // التحرك كل 45 ثانية
    movementInterval = setInterval(() => {
        if (!mcClient) return;

        try {
            // تدوير زاوية نظر البوت بـ 45 درجة
            currentYaw = (currentYaw + 45) % 360;

            mcClient.queue('player_auth_input', {
                pitch: 0,
                yaw: currentYaw,
                position: { x: 0, y: 0, z: 0 },
                move_vector: { x: 0, z: 0 },
                head_yaw: currentYaw,
                input_data: 0,
                input_mode: 'mouse',
                play_mode: 'normal',
                interaction_model: 'classic',
                tick: 0n
            });
            console.log("🔄 تم تحديث حركة البوت لتفادي الطرد.");
        } catch (err) {
            console.error("خطأ أثناء إرسال حزمة الحركة:", err.message);
        }
    }, 45000);
};

const stopAntiAfkLoop = () => {
    if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
    }
};

const keyboardOptions = {
    reply_markup: {
        keyboard: [
            [{ text: '🟢 دخول السيرفر (Start)' }, { text: '🔴 الخروج من السيرفر (Stop)' }]
        ],
        resize_keyboard: true,
        is_persistent: true
    }
};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "أهلاً بك! استخدم الأزرار للتحكم:", keyboardOptions);
});

const startAfk = (chatId) => {
    if (mcClient) {
        bot.sendMessage(chatId, "⚠️ البوت متصل بالسيرفر بالفعل!");
        return;
    }
    bot.sendMessage(chatId, "⏳ جارٍ الاتصال بسيرفر ماين كرافت...");
    try {
        mcClient = bedrock.createClient({
            host: MC_SERVER_IP,
            port: MC_SERVER_PORT,
            username: BOT_USERNAME,
            offline: true 
        });

        mcClient.on('join', () => {
            bot.sendMessage(chatId, "✅ تم دخول السيرفر بنجاح! تم تفعيل نظام منع طرد الـ AFK.");
            startAntiAfkLoop();
        });

        mcClient.on('disconnect', (packet) => {
            bot.sendMessage(chatId, `❌ تم فصل البوت من السيرفر.`);
            stopAntiAfkLoop();
            mcClient = null;
        });
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ أثناء الاتصال: ${error.message}`);
        stopAntiAfkLoop();
        mcClient = null;
    }
};

const stopAfk = (chatId) => {
    if (!mcClient) {
        bot.sendMessage(chatId, "⚠️ البوت غير متصل بالسيرفر حالياً.");
        return;
    }
    stopAntiAfkLoop();
    mcClient.disconnect();
    mcClient = null;
    bot.sendMessage(chatId, "🛑 تم الخروج من السيرفر بنجاح.");
};

bot.on('message', (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === '🟢 دخول السيرفر (Start)' || text === '/start_afk') {
        startAfk(chatId);
    } 
    else if (text === '🔴 الخروج من السيرفر (Stop)' || text === '/stop_afk') {
        stopAfk(chatId);
    }
});

console.log("🤖 البوت يعمل الآن!");
