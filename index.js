/**
 * Minecraft Bedrock 24/7 Anti-AFK Bot with Telegram Control
 * تم فحص هذا الكود وإصلاحه ليعمل 24/7 بدون نوم وبدون طرد من السيرفر
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const bedrock = require('bedrock-protocol');
const http = require('http');

// ================= الإعدادات والمتغيرات =================
// يفضل دائماً وضع التوكن في ملف .env أو إعدادات الاستضافة
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8882158605:AAF8806Nkn09L62spluqJyh4c1Oz2pUt8CM';
let MC_SERVER_IP = process.env.MC_SERVER_IP || 'sweet_couple.aternos.me';
let MC_SERVER_PORT = parseInt(process.env.MC_SERVER_PORT || '41806', 10);
const BOT_USERNAME = process.env.BOT_USERNAME || 'AK7_Bot';
const ADMIN_ID = process.env.ADMIN_ID || ''; // اختياري لحماية البوت من المتطفلين

const PORT = process.env.PORT || 8080;
const AFK_INTERVAL_MS = 30000;
const AUTO_RECONNECT = true;
const RECONNECT_DELAY_MS = 15000;
// ========================================================

// فحص وجود التوكن
if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('YOUR_TELEGRAM')) {
    console.error('❌ خطأ فادح: لم تقم بوضع TELEGRAM_TOKEN في ملف .env أو إعدادات البيئة!');
    process.exit(1);
}

// دالة تسجيل منسقة بالوقت
function log(tag, message, ...args) {
    const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
    console.log(`[${time}] [${tag}] ${message}`, ...args);
}

// ================= خادم إبقاء الحاوية مستيقظة (Keep-Alive) =================
// هذا الخادم هو الحل لمشكلة نوم Back4app و Render
const server = http.createServer((req, res) => {
    // نقطة فحص الصحة لخدمات UptimeRobot و Cron-Job
    if (req.url === '/ping' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            status: 'online',
            service: 'Minecraft Bedrock AFK Bot',
            mcConnected: mcClient !== null,
            targetServer: `${MC_SERVER_IP}:${MC_SERVER_PORT}`,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        }));
    }

    // صفحة الويب الرئيسية
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html dir="rtl" style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
            <head><title>Bedrock AFK Bot Status</title></head>
            <body>
                <h1 style="color: #22c55e;">🟢 بوت ماين كرافت بدروك يعمل بنجاح!</h1>
                <p>الحالة: <strong>${mcClient ? 'متصل بالسيرفر ✅' : 'غير متصل حالياً ⏸️'}</strong></p>
                <p>السيرفر المستهدف: <code>${MC_SERVER_IP}:${MC_SERVER_PORT}</code></p>
                <p>وقت التشغيل: <code>${Math.floor(process.uptime() / 60)} دقيقة</code></p>
                <hr style="border-color: #334155; margin: 20px auto; max-width: 400px;" />
                <p style="color: #94a3b8; font-size: 14px;">ضع رابط هذا الموقع مع مسار <code>/ping</code> في موقع UptimeRobot كل 5 دقائق لمنع النوم.</p>
            </body>
        </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    log('HTTP', `🌐 خادم الويب يعمل على المنفذ ${PORT} لاستقبال الـ Ping`);
});

// ================= عميل التيليجرام =================
const bot = new Telegraf(TELEGRAM_TOKEN);
let mcClient = null;
let movementInterval = null;
let currentYaw = 0;
let currentTick = 0n;
let activeChatId = null;
let shouldStayConnected = false;
let reconnectTimeout = null;

// حفظ موقع البوت الفعلي لتفادي طرده بسبب (0, 0, 0)
let playerPos = { x: 0, y: 64, z: 0 };
let hasReceivedPosition = false;

// دالة آمنة لإرسال رسائل التلغرام دون التعطل بسبب ctx منتهي
async function notify(message, extra = {}) {
    if (!activeChatId) return;
    try {
        await bot.telegram.sendMessage(activeChatId, message, { parse_mode: 'HTML', ...extra });
    } catch (err) {
        log('TELEGRAM', '⚠️ تعذر إرسال إشعار التلغرام:', err.message);
    }
}

// دالة التحقق من صلاحية المستخدم
function isAuthorized(ctx) {
    if (!ADMIN_ID || ADMIN_ID.trim() === '') return true; // إذا لم يُحدد أدمن فالكل مسموح
    const senderId = ctx.from ? ctx.from.id.toString() : '';
    return senderId === ADMIN_ID.toString();
}

// ================= دورة مكافحة الطرد (Anti-AFK Loop) =================
const startAntiAfkLoop = () => {
    stopAntiAfkLoop();
    log('ANTI_AFK', '🚀 تم بدء مؤقت الحركة وتدوير الرأس لمنع الطرد.');
    
    movementInterval = setInterval(() => {
        if (!mcClient) return;

        try {
            currentYaw = (currentYaw + 45) % 360;
            currentTick += 20n;

            // إرسال حزمة حركة خفيفة باستخدام الموقع الحقيقي للاعب
            mcClient.queue('player_auth_input', {
                pitch: 0,
                yaw: currentYaw,
                position: playerPos, // موقع اللاعب الحقيقي وليس أصفاراً!
                move_vector: { x: 0, z: 0 },
                head_yaw: currentYaw,
                input_data: 0,
                input_mode: 'mouse',
                play_mode: 'normal',
                interaction_model: 'classic',
                tick: currentTick
            });

            // حركة خفيفة لتبديل الذراع (Swing Arm) لمحاكاة نشاط اللاعب
            mcClient.queue('animate', {
                action_id: 1, // Swing Arm
                runtime_entity_id: mcClient.entityId || 0n
            });

            log('ANTI_AFK', `🔄 تم تدوير زاوية الرأس إلى ${currentYaw}° والحفاظ على الموقع`);
        } catch (err) {
            log('ANTI_AFK', '⚠️ خطأ أثناء إرسال حزمة الحركة:', err.message);
        }
    }, AFK_INTERVAL_MS);
};

const stopAntiAfkLoop = () => {
    if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
        log('ANTI_AFK', '⏹️ تم إيقاف مؤقت مكافحة الطرد.');
    }
};

// ================= دالة الاتصال بسيرفر ماين كرافت بدروك =================
function connectBedrock() {
    if (mcClient) {
        log('MINECRAFT', '⚠️ البوت متصل بالفعل!');
        return;
    }

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    log('MINECRAFT', `⏳ جاري الاتصال بسيرفر ${MC_SERVER_IP}:${MC_SERVER_PORT} باسم ${BOT_USERNAME}...`);
    notify(`⏳ <b>جارٍ الاتصال بسيرفر ماين كرافت:</b>\n<code>${MC_SERVER_IP}:${MC_SERVER_PORT}</code>`);

    try {
        mcClient = bedrock.createClient({
            host: MC_SERVER_IP,
            port: MC_SERVER_PORT,
            username: BOT_USERNAME,
            offline: true,
            // ملاحظة: تم حذف الإصدار الوهمي '1.26.0' ليقوم bedrock-protocol بفحص إصدار السيرفر ومطابقته تلقائياً
            skipPing: false,
            connectTimeout: 30000
        });

        // التقاط موقع البوت الفعلي عند بدء اللعبة
        mcClient.on('start_game', (packet) => {
            if (packet.player_position) {
                playerPos = {
                    x: packet.player_position.x || 0,
                    y: packet.player_position.y || 64,
                    z: packet.player_position.z || 0
                };
                hasReceivedPosition = true;
                log('MINECRAFT', `📍 تم رصد موقع البوت الابتدائي: X=${playerPos.x.toFixed(1)}, Y=${playerPos.y.toFixed(1)}, Z=${playerPos.z.toFixed(1)}`);
            }
        });

        // تحديث الموقع عند أي حركة أو تيليبورت
        mcClient.on('move_player', (packet) => {
            if (packet.position) {
                playerPos = { ...packet.position };
            }
        });

        mcClient.on('join', () => {
            log('MINECRAFT', '✅ دخل البوت السيرفر بنجاح!');
            notify(`✅ <b>تم دخول السيرفر بنجاح!</b>\nالسيرفر: <code>${MC_SERVER_IP}:${MC_SERVER_PORT}</code>\nالاسم: <code>${BOT_USERNAME}</code>\n🛡️ تم تفعيل نظام منع الطرد التلقائي.`);
            startAntiAfkLoop();
        });

        mcClient.on('disconnect', (packet) => {
            let reason = 'تم إغلاق الاتصال من السيرفر';
            if (typeof packet === 'string') reason = packet;
            else if (packet && packet.reason) reason = packet.reason;
            else if (packet && packet.message) reason = packet.message;

            log('MINECRAFT', `❌ تم فصل البوت. السبب: ${reason}`);
            notify(`❌ <b>تم فصل البوت من السيرفر!</b>\nالسبب: <code>${reason}</code>`);

            stopAntiAfkLoop();
            mcClient = null;

            if (AUTO_RECONNECT && shouldStayConnected) {
                scheduleAutoReconnect();
            }
        });

        mcClient.on('error', (err) => {
            log('MINECRAFT', `⚠️ مشكلة في اتصال السيرفر: ${err.message}`);
            notify(`⚠️ <b>مشكلة في الاتصال بسيرفر ماين كرافت:</b>\n<code>${err.message}</code>`);

            stopAntiAfkLoop();
            if (mcClient) {
                try { mcClient.close(); } catch(e) {}
                mcClient = null;
            }

            if (AUTO_RECONNECT && shouldStayConnected) {
                scheduleAutoReconnect();
            }
        });

        mcClient.on('kick', (packet) => {
            log('MINECRAFT', '⚠️ تم طرد البوت من السيرفر:', JSON.stringify(packet));
            notify(`⚠️ <b>تم طرد البوت (Kick) من السيرفر!</b>\n${JSON.stringify(packet)}`);
        });

    } catch (error) {
        log('MINECRAFT', `❌ فشل إنشاء عميل Bedrock: ${error.message}`);
        notify(`❌ <b>فشل إنشاء الاتصال:</b> <code>${error.message}</code>`);
        stopAntiAfkLoop();
        mcClient = null;
        if (AUTO_RECONNECT && shouldStayConnected) scheduleAutoReconnect();
    }
}

// دالة جدولة إعادة الاتصال التلقائي
function scheduleAutoReconnect() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    log('MINECRAFT', `🔄 ستتم محاولة إعادة الاتصال تلقائياً بعد ${RECONNECT_DELAY_MS / 1000} ثانية...`);
    notify(`🔄 <b>سيتم محاولة إعادة الاتصال تلقائياً خلال ${RECONNECT_DELAY_MS / 1000} ثانية...</b>`);
    
    reconnectTimeout = setTimeout(() => {
        if (shouldStayConnected && !mcClient) {
            connectBedrock();
        }
    }, RECONNECT_DELAY_MS);
}

// ================= أوامر التيليجرام ولوحة التحكم =================
const keyboard = Markup.keyboard([
    ['🟢 دخول السيرفر (Start)', '🔴 الخروج من السيرفر (Stop)'],
    ['📊 حالة البوت (Status)', '🔄 إعادة اتصال فوري'],
    ['⚙️ معلومات السيرفر الحالي', '❓ مساعدة (Help)']
]).resize();

bot.start((ctx) => {
    activeChatId = ctx.chat.id;
    if (!isAuthorized(ctx)) {
        return ctx.reply('⛔ عذراً! هذا البوت خاص وغير مصرح لك باستخدامه.');
    }
    ctx.reply(
        `👋 مرحباً بك في لوحة تحكم <b>Minecraft Bedrock AFK Bot</b>!\n\n` +
        `📌 <b>السيرفر المحدد:</b> <code>${MC_SERVER_IP}:${MC_SERVER_PORT}</code>\n` +
        `🤖 <b>اسم البوت:</b> <code>${BOT_USERNAME}</code>\n\n` +
        `استخدم الأزرار أدناه للتحكم:`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// زر الدخول
bot.hears(['🟢 دخول السيرفر (Start)', '/start_afk'], (ctx) => {
    if (!isAuthorized(ctx)) return ctx.reply('⛔ غير مصرح لك.');
    activeChatId = ctx.chat.id;
    
    if (mcClient) {
        return ctx.reply('⚠️ البوت متصل بالسيرفر بالفعل وفي حالة نشطة!');
    }

    shouldStayConnected = true;
    connectBedrock();
});

// زر الخروج
bot.hears(['🔴 الخروج من السيرفر (Stop)', '/stop_afk'], (ctx) => {
    if (!isAuthorized(ctx)) return ctx.reply('⛔ غير مصرح لك.');
    activeChatId = ctx.chat.id;

    shouldStayConnected = false;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (!mcClient) {
        return ctx.reply('⚠️ البوت غير متصل بالسيرفر حالياً.');
    }

    stopAntiAfkLoop();
    try {
        mcClient.disconnect();
    } catch(e) {}
    mcClient = null;
    ctx.reply('🛑 تم الخروج من السيرفر وإيقاف إعادة الاتصال التلقائي.');
});

// زر الحالة
bot.hears(['📊 حالة البوت (Status)', '/status'], (ctx) => {
    if (!isAuthorized(ctx)) return ctx.reply('⛔ غير مصرح لك.');
    activeChatId = ctx.chat.id;

    const isConnected = mcClient !== null;
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;

    ctx.reply(
        `📊 <b>تقرير حالة البوت:</b>\n\n` +
        `• <b>حالة الاتصال:</b> ${isConnected ? '🟢 متصل بالسيرفر' : '🔴 غير متصل'}\n` +
        `• <b>السيرفر:</b> <code>${MC_SERVER_IP}:${MC_SERVER_PORT}</code>\n` +
        `• <b>الاسم:</b> <code>${BOT_USERNAME}</code>\n` +
        `• <b>إعادة الاتصال التلقائي:</b> ${AUTO_RECONNECT ? 'مفعل ✅' : 'معطل ❌'}\n` +
        `• <b>موقع البوت:</b> X: ${playerPos.x.toFixed(1)}, Y: ${playerPos.y.toFixed(1)}, Z: ${playerPos.z.toFixed(1)}\n` +
        `• <b>مدة تشغيل العملية:</b> ${hours} ساعة و ${mins} دقيقة و ${secs} ثانية\n` +
        `• <b>خادم الويب:</b> <code>http://0.0.0.0:${PORT}/ping</code>`,
        { parse_mode: 'HTML' }
    );
});

// إعادة اتصال فورية
bot.hears(['🔄 إعادة اتصال فوري', '/reconnect'], (ctx) => {
    if (!isAuthorized(ctx)) return ctx.reply('⛔ غير مصرح لك.');
    activeChatId = ctx.chat.id;

    ctx.reply('🔄 جاري إعادة تشغيل جلسة الاتصال...');
    shouldStayConnected = true;
    if (mcClient) {
        try { mcClient.disconnect(); } catch(e) {}
        mcClient = null;
    }
    stopAntiAfkLoop();
    setTimeout(() => connectBedrock(), 1500);
});

// تغيير السيرفر والبورت مباشرة من التليجرام (حل لمشكلة بورت Aternos المتغير!)
bot.command('setserver', (ctx) => {
    if (!isAuthorized(ctx)) return ctx.reply('⛔ غير مصرح لك.');
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 3) {
        return ctx.reply(
            '⚠️ <b>صيغة الأمر غير صحيحة!</b>\n' +
            'الاستخدام الصحيح:\n' +
            '<code>/setserver &lt;IP&gt; &lt;PORT&gt;</code>\n\n' +
            'مثال:\n<code>/setserver sweet_couple.aternos.me 41806</code>',
            { parse_mode: 'HTML' }
        );
    }

    const newIp = parts[1];
    const newPort = parseInt(parts[2], 10);
    if (isNaN(newPort) || newPort <= 0 || newPort > 65535) {
        return ctx.reply('❌ رقم البورت (Port) غير صالح!');
    }

    MC_SERVER_IP = newIp;
    MC_SERVER_PORT = newPort;
    ctx.reply(
        `✅ <b>تم تحديث بيانات السيرفر بنجاح!</b>\n` +
        `• العنوان الجديد: <code>${MC_SERVER_IP}:${MC_SERVER_PORT}</code>\n` +
        `اضغط الآن على 🟢 دخول السيرفر لبدء الاتصال.`,
        { parse_mode: 'HTML' }
    );
});

// معلومات السيرفر
bot.hears(['⚙️ معلومات السيرفر الحالي', '/server'], (ctx) => {
    ctx.reply(
        `⚙️ <b>بيانات السيرفر الحالية:</b>\n\n` +
        `• العنوان: <code>${MC_SERVER_IP}</code>\n` +
        `• البورت: <code>${MC_SERVER_PORT}</code>\n\n` +
        `لتغييرها إذا تغير بورت Aternos أرسل:\n` +
        `<code>/setserver &lt;IP&gt; &lt;PORT&gt;</code>`,
        { parse_mode: 'HTML' }
    );
});

// مساعدة
bot.hears(['❓ مساعدة (Help)', '/help'], (ctx) => {
    ctx.reply(
        `📖 <b>قائمة الأوامر المتاحة:</b>\n\n` +
        `• 🟢 <code>دخول السيرفر</code> أو <code>/start_afk</code> - لدخول ماين كرافت\n` +
        `• 🔴 <code>الخروج</code> أو <code>/stop_afk</code> - لقطع الاتصال\n` +
        `• 📊 <code>/status</code> - فحص حالة البوت والوقت\n` +
        `• 🔄 <code>/reconnect</code> - إعادة الاتصال فوراً\n` +
        `• ⚙️ <code>/setserver &lt;ip&gt; &lt;port&gt;</code> - تغيير السيرفر أو البورت\n` +
        `• 🌐 رابط الفحص الدوري لمنع النوم: <code>/ping</code>\n\n` +
        `🛡️ <i>تم تزويد البوت بنظام حماية ضد الطرد وحفظ تلقائي للموقع.</i>`,
        { parse_mode: 'HTML' }
    );
});

// ================= تشغيل البوت وحمايته من الانهيار =================
bot.launch().then(() => {
    log('TELEGRAM', '🤖 بوت التيليجرام متصل وجاهز لاستقبال الأوامر!');
}).catch((err) => {
    log('TELEGRAM', '❌ فشل بدء بوت التيليجرام:', err.message);
});

// درع الحماية الشاملة من الانهيار الصامت
process.on('uncaughtException', (err) => {
    log('CRASH_GUARD', '⚠️ تم التقاط خطأ غير متوقع ومنع انهيار البوت:', err.stack || err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    log('CRASH_GUARD', '⚠️ تم التقاط رفض غير معالج (Unhandled Rejection):', reason);
});

// إيقاف هادئ عند تلقي إشارة إنهاء من نظام التشغيل
process.once('SIGINT', () => {
    log('SYSTEM', '🛑 تلقي إشارة SIGINT، جاري الإغلاق بأمان...');
    stopAntiAfkLoop();
    if (mcClient) try { mcClient.disconnect(); } catch(e) {}
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    log('SYSTEM', '🛑 تلقي إشارة SIGTERM، جاري الإغلاق بأمان...');
    stopAntiAfkLoop();
    if (mcClient) try { mcClient.disconnect(); } catch(e) {}
    bot.stop('SIGTERM');
    process.exit(0);
});
