const TelegramBot = require('node-telegram-bot-api');
const bedrock = require('bedrock-protocol');

// ================= الإعدادات =================
const TELEGRAM_TOKEN = '8882158605:AAF_HVfk3p5eev3KueWkveVNYUPXLtRi88Y';
const MC_SERVER_IP = 'sweet_couple.aternos.me';
const MC_SERVER_PORT = 41806;
const BOT_USERNAME = 'AK7_Bot'; 
// =============================================

// تفعيل بوت التيليجرام
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let mcClient = null;

// أمر الدخول للسيرفر
bot.onText(/\/start_afk/, (msg) => {
    const chatId = msg.chat.id;
    
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
            offline: true // اجعلها false إذا كان السيرفر يتطلب حساب Xbox Live أصلي
        });

        mcClient.on('join', () => {
            bot.sendMessage(chatId, "✅ تم دخول السيرفر بنجاح! البوت الآن AFK.");
        });

        mcClient.on('disconnect', (packet) => {
            bot.sendMessage(chatId, `❌ تم فصل البوت من السيرفر. السبب: ${packet}`);
            mcClient = null;
        });

    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ أثناء الاتصال: ${error.message}`);
        mcClient = null;
    }
});

// أمر الخروج من السيرفر
bot.onText(/\/stop_afk/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!mcClient) {
        bot.sendMessage(chatId, "⚠️ البوت غير متصل بالسيرفر حالياً.");
        return;
    }

    mcClient.disconnect();
    mcClient = null;
    bot.sendMessage(chatId, "🛑 تم الخروج من السيرفر بنجاح.");
});

console.log("🤖 البوت يعمل الآن! اذهب إلى تيليجرام وأرسل /start_afk");
