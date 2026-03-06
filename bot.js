require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()));

// State management for adding movies
const userState = new Map();

// Middleware for database initialization and user tracking
bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    
    if (ctx.startPayload && !isNaN(ctx.startPayload)) {
        const referrerId = parseInt(ctx.startPayload);
        if (referrerId !== ctx.from.id) {
            await db.upsertUser(ctx.from.id, ctx.from.username || ctx.from.first_name, referrerId);
        } else {
            await db.upsertUser(ctx.from.id, ctx.from.username || ctx.from.first_name);
        }
    } else {
        await db.upsertUser(ctx.from.id, ctx.from.username || ctx.from.first_name);
    }
    
    return next();
});

// Middleware: Mandatory Subscription Check for multiple channels
const checkSub = async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    if (ADMIN_IDS.includes(ctx.from.id)) return next();

    const channels = await db.getChannels();
    if (channels.length === 0) return next();

    const unsubs = [];
    for (const channel of channels) {
        try {
            const member = await ctx.telegram.getChatMember(channel.chat_id, ctx.from.id);
            if (!['member', 'administrator', 'creator'].includes(member.status)) {
                unsubs.push(channel);
            }
        } catch (e) {
            console.error(`Sub check failed for ${channel.chat_id}:`, e);
        }
    }

    if (unsubs.length === 0) return next();

    const buttons = unsubs.map(ch => [Markup.button.url(ch.title, `https://t.me/c/${ch.chat_id.replace('-100', '')}/1`)]);
    buttons.push([Markup.button.callback('✅ Tekshirish', 'check_sub')]);

    return ctx.reply(`Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling:`, Markup.inlineKeyboard(buttons));
};

// Handlers
bot.start(checkSub, async (ctx) => {
    const message = `Assalomu alaykum ${ctx.from.first_name}! 🎬\n\nBu bot orqali kinolarni kodi yoki nomi bilan qidirib topishingiz mumkin.\n🔍 Shunchaki kino kodi yoki nomini yuboring.`;
    
    const buttons = [
        [Markup.button.callback('🎲 Tasodifiy kino', 'random_movie'), Markup.button.callback('👤 Kabinet', 'profile')],
        [Markup.button.callback('🏆 Reyting', 'leaderboard'), Markup.button.callback('🔗 Taklif qilish', 'my_link')]
    ];

    await ctx.reply(message, Markup.inlineKeyboard(buttons));
});

bot.action('check_sub', checkSub, (ctx) => ctx.reply('Rahmat! Endi botdan foydalanishingiz mumkin.'));

bot.action('random_movie', checkSub, async (ctx) => {
    const movie = await db.getRandomMovie();
    if (movie) {
        return ctx.replyWithVideo(movie.file_id, { caption: `🎬 ${movie.name}\n\n🤖 @${ctx.botInfo.username}` });
    }
    await ctx.reply('Hozircha kinolar yo\'q 😔');
});

bot.action('profile', async (ctx) => {
    const user = await db.getUser(ctx.from.id);
    const text = `👤 **Sizning profilingiz:**\n\n🆔 ID: \`${ctx.from.id}\`\n👤 Ism: ${ctx.from.first_name}\n💎 Ballaringiz: ${user.points}\n\nOdam taklif qilib ball yig'ing va sovg'alarga ega bo'ling!`;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'back_to_start')]]) });
});

bot.action('my_link', async (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    await ctx.reply(`Sizning taklif havolangiz:\n\n${link}\n\nUshbu havola orqali kirgan har bir do'stingiz uchun 1 ball beriladi! 🎁`);
});

bot.action('leaderboard', async (ctx) => {
    const top = await db.getTopReferrers();
    let text = "🏆 **Eng ko'p do'st taklif qilganlar:**\n\n";
    top.forEach((u, i) => {
        text += `${i + 1}. ${u.username || 'Noma\'lum'} — ${u.points} ball\n`;
    });
    if (top.length === 0) text += "Hozircha hech kim yo'q.";
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'back_to_start')]]) });
});

bot.action('back_to_start', async (ctx) => {
    const message = `Assalomu alaykum ${ctx.from.first_name}! 🎬\n\nBu bot orqali kinolarni kodi yoki nomi bilan qidirib topishingiz mumkin.\n🔍 Shunchaki kino kodi yoki nomini yuboring.`;
    const buttons = [
        [Markup.button.callback('🎲 Tasodifiy kino', 'random_movie'), Markup.button.callback('👤 Kabinet', 'profile')],
        [Markup.button.callback('🏆 Reyting', 'leaderboard'), Markup.button.callback('🔗 Taklif qilish', 'my_link')]
    ];
    await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
});

// Admin Panel Logic
bot.command('admin', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    ctx.reply('Admin panel uchun parolni kiriting:');
    userState.set(ctx.from.id, { step: 'awaiting_password' });
});

// Universal Message Handler
bot.on('message', checkSub, async (ctx) => {
    const userId = ctx.from.id;
    const state = userState.get(userId);

    if (ADMIN_IDS.includes(userId) && state) {
        if (state.step === 'awaiting_password') {
            if (ctx.message.text === 'munisbek2828') {
                userState.set(userId, { step: 'admin_menu' });
                return ctx.reply('Xush kelibsiz, Admin!', Markup.inlineKeyboard([
                    [Markup.button.callback('➕ Kino qo\'shish', 'add_movie'), Markup.button.callback('➖ Kino o\'chirish', 'delete_movie')],
                    [Markup.button.callback('📢 Reklama', 'broadcast'), Markup.button.callback('📊 Stats', 'stats')],
                    [Markup.button.callback('➕ Kanal qo\'shish', 'add_channel'), Markup.button.callback('➖ Kanallar', 'list_channels')]
                ]));
            } else {
                userState.delete(userId);
                return ctx.reply('Parol noto\'g\'ri!');
            }
        }
        
        // Channel Management
        if (state.step === 'awaiting_channel_id') {
            userState.set(userId, { step: 'awaiting_channel_title', chatId: ctx.message.text });
            return ctx.reply('Kanal nomini (title) kiriting:');
        }
        if (state.step === 'awaiting_channel_title') {
            await db.addChannel(state.chatId, ctx.message.text);
            userState.set(userId, { step: 'admin_menu' });
            return ctx.reply('✅ Kanal muvaffaqiyatli qo\'shildi!');
        }

        if (state.step === 'awaiting_video') {
            if (ctx.message.video || ctx.message.document) {
                const fileId = ctx.message.video ? ctx.message.video.file_id : ctx.message.document.file_id;
                userState.set(userId, { step: 'awaiting_about', fileId });
                return ctx.reply('Kino haqida ma\'lumot (tavsif) yuboring:');
            }
            return ctx.reply('Iltimos, video fayl yuboring.');
        }

        if (state.step === 'awaiting_about') {
            const about = ctx.message.text;
            userState.set(userId, { ...state, step: 'awaiting_code', about });
            return ctx.reply('Kino uchun kod yuboring:');
        }

        if (state.step === 'awaiting_code') {
            const code = ctx.message.text;
            try {
                await db.addMovie(state.about, code, state.fileId);
                userState.set(userId, { step: 'admin_menu' });
                return ctx.reply(`✅ Kino muvaffaqiyatli qo'shildi!\nKodi: ${code}`);
            } catch (e) {
                return ctx.reply('Xatolik! Kod band bo\'lishi mumkin.');
            }
        }

        if (state.step === 'awaiting_delete_code') {
            await db.deleteMovieByCode(ctx.message.text);
            userState.set(userId, { step: 'admin_menu' });
            return ctx.reply('🗑 O\'chirildi.');
        }

        if (state.step === 'awaiting_broadcast') {
            const userIds = await db.getAllUserIds();
            ctx.reply(`Tarqatilmoqda...`);
            for (const id of userIds) {
                try { await ctx.telegram.copyMessage(id, ctx.chat.id, ctx.message.message_id); } catch (e) {}
            }
            userState.set(userId, { step: 'admin_menu' });
            return ctx.reply('✅ Tayyor.');
        }
    }

    const query = ctx.message.text;
    if (!query) return;

    const movieByCode = await db.getMovieByCode(query);
    if (movieByCode) {
        return ctx.replyWithVideo(movieByCode.file_id, { caption: `🎬 ${movieByCode.name}\n\n🤖 @${ctx.botInfo.username}` });
    }

    const moviesByName = await db.getMoviesByName(query);
    if (moviesByName.length > 0) {
        if (moviesByName.length === 1) {
            return ctx.replyWithVideo(moviesByName[0].file_id, { caption: `🎬 ${moviesByName[0].name}\n\n🤖 @${ctx.botInfo.username}` });
        }
        let list = "🔍 Natijalar:\n\n";
        moviesByName.forEach(m => { list += `🔹 ${m.name} — <code>${m.code}</code>\n`; });
        return ctx.replyWithHTML(list);
    }

    await ctx.reply('Hech narsa topilmadi 😔');
});

// Admin Actions Handlers
bot.action('add_movie', (ctx) => {
    userState.set(ctx.from.id, { step: 'awaiting_video' });
    ctx.reply('Kino faylini (video) yuboring:');
});

bot.action('delete_movie', (ctx) => {
    userState.set(ctx.from.id, { step: 'awaiting_delete_code' });
    ctx.reply('O\'chirmoqchi bo\'lgan kino kodini yuboring:');
});

bot.action('stats', async (ctx) => {
    const stats = await db.getStats();
    ctx.reply(`📊 Bot statistikasi:\n\n👥 Foydalanuvchilar: ${stats.users}\n🎬 Kinolar: ${stats.movies}`);
});

bot.action('broadcast', (ctx) => {
    userState.set(ctx.from.id, { step: 'awaiting_broadcast' });
    ctx.reply('Barcha foydalanuvchilarga yubormoqchi bo\'lgan xabaringizni yuboring:');
});

bot.action('add_channel', (ctx) => {
    userState.set(ctx.from.id, { step: 'awaiting_channel_id' });
    ctx.reply('Kanal ID sini yuboring (Masalan: -100123456789):');
});

bot.action('list_channels', async (ctx) => {
    const channels = await db.getChannels();
    if (channels.length === 0) return ctx.reply('Kanallar yo\'q');
    let text = "📢 Kanallar ro'yxati:\n\n";
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.title}`, `del_ch_${ch.id}`)]);
    ctx.reply(text, Markup.inlineKeyboard(buttons));
});

bot.on('callback_query', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith('del_ch_')) {
        const id = data.split('_')[2];
        await db.deleteChannel(id);
        return ctx.answerCbQuery('Kanal o\'chirildi');
    }
    return next();
});

async function start() {
    await db.initDb();
    bot.launch();
    console.log('Bot started');

    // Simple HTTP server for hosting health checks (e.g., Render)
    const port = process.env.PORT || 3000;
    http.createServer((req, res) => {
        res.writeHead(200);
        res.end('Bot is running!');
    }).listen(port);
    console.log(`Health check server listening on port ${port}`);
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
