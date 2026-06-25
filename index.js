const { Client, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const client = new Client({intents: 131071});
client.setMaxListeners(0);
const { readdirSync } = require("fs")
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const mongodb = require('mongoose');
const { token , mainguild , database , WEBHOOK_URL } = require(`./config.json`)
const ascii = require('ascii-table');
const { Database } = require("st.db");
const buyerCheckerDB = new Database('./Json-db/Others/buyerChecker.json')
const { owner , prefix} = require('./config.json');
const archiver  = require('archiver');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Validate token before login
if (!token || token.trim() === '') {
    console.error('❌ ERROR: Bot token is empty! Please set a valid token in config.json');
    process.exit(1);
}

client.login(token).catch(err => {
    console.error('❌ Token login failed:', err.message);
    console.error('Please check your token in config.json');
});
client.commandaliases = new Collection()
const rest = new REST({ version: '10' }).setToken(token);
module.exports = client;
exports.mainBot = client;
client.on("ready", async () => {
	try {
		//  تسجيل اوامر السلاش كوماند (guild-only في mainguild فقط)
		await rest.put(
			Routes.applicationGuildCommands(client.user.id, mainguild),
			{ body: [...slashcommands, ...guildSlashCommands] },
		);

		// مسح الأوامر الـ global القديمة
		await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [] },
        );

	} catch (error) {
		console.error(error);
	}
	// الاتصال بالمونجو
	await mongodb.connect(database , {
	}).then(async()=> {
		console.log('🟢 Connected To Database Successfully 🟢')
	}).catch(()=> {
		console.log(`🔴 Failed Connect To Database 🔴`)
	});

	// حذف حميع المعلومات في ملف التحقق من عمليات الشراء
	buyerCheckerDB.deleteAll();

    // ═══════════════════════════════════════════
    // 🔥 تحميل جميع البوتات الفرعية تلقائياً
    // ═══════════════════════════════════════════
    const { loadAllSubBots } = require('./subBotLoader');
    loadAllSubBots();

    // نظام فحص الاشتراكات المركزي (بدل setInterval في كل بوت)
    const { startSubscriptionChecker } = require('./utils/subscriptionChecker');
    startSubscriptionChecker(client);

    // نظام فحص جيف اويات الإعلانات (سحب فائزين تلقائي + حذف الرومات الخاصة)
    const { startAdsGiveawayChecker } = require('./utils/adsGiveawayChecker');
    startAdsGiveawayChecker();

    console.log(`Done set everything`);
	
})
client.slashcommands = new Collection()
const slashcommands = [];
const guildSlashCommands = [];
const table = new ascii('Owner Commands').setJustify();
for (let folder of readdirSync('./ownerOnly/').filter(folder => !folder.includes('.') && folder !== 'Developers')) {
  for (let file of readdirSync('./ownerOnly/' + folder).filter(f => f.endsWith('.js'))) {
	  let command = require(`./ownerOnly/${folder}/${file}`);
	  if(command) {
		  slashcommands.push(command.data.toJSON());
          client.slashcommands.set(command.data.name, command);
		  if(command.data.name) {
			  table.addRow(`/${command.data.name}` , '🟢 Working')
		  }
		  if(!command.data.name) {
			  table.addRow(`/${command.data.name}` , '🔴 Not Working')
		  }
	  }
  }
}

// Load guild-specific slash commands
for (let file of readdirSync('./ownerOnly/Developers').filter(f => f.endsWith('.js'))) {
    let command = require(`./ownerOnly/Developers/${file}`);
    if (command) {
        guildSlashCommands.push(command.data.toJSON());
        client.slashcommands.set(command.data.name, command);
        table.addRow(`/${command.data.name}`, '🟢 Working for mainguild');
    }
}

console.log(table.toString())

console.log(`\x1b[33m
 ██╗  ██╗██╗███╗   ██╗ ██████╗ 
 ██║ ██╔╝██║████╗  ██║██╔════╝ 
 █████╔╝ ██║██╔██╗ ██║██║  ███╗
 ██╔═██╗ ██║██║╚██╗██║██║   ██║
 ██║  ██╗██║██║ ╚████║╚██████╔╝
 ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ 
\x1b[0m`);

for (let folder of readdirSync('./events/').filter(folder => !folder.includes('.'))) {
	for (let file of readdirSync('./events/' + folder).filter(f => f.endsWith('.js'))) {
		const event = require(`./events/${folder}/${file}`);
	if (!event || !event.name) continue;
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
	}
  }
  for (let folder of readdirSync('./buttons/').filter(folder => !folder.includes('.'))) {
	for (let file of readdirSync('./buttons/' + folder).filter(f => f.endsWith('.js'))) {
		const event = require(`./buttons/${folder}/${file}`);
	if (!event || !event.name) continue;
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
	}
  }
  //
  for(let file of readdirSync('./database/').filter(file => file.endsWith('.js'))) {
	const reuirenation = require(`./database/${file}`)
  }

// Your webhook URL
// Folders to backup
const FOLDERS_TO_BACKUP = ['Json-db', 'database' , 'tokens'];
// Path to save the zip file
const BACKUP_PATH = path.join(__dirname, 'backup.zip');

// Function to create a zip archive
function createBackup() {
    const output = fs.createWriteStream(BACKUP_PATH);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`Backup created: ${archive.pointer()} total bytes`);
        sendBackupToWebhook();
    });

    archive.on('error', (err) => {
        console.error('Archive error:', err);
    });

    archive.pipe(output);

    FOLDERS_TO_BACKUP.forEach((folder) => {
        const folderPath = path.join(__dirname, folder);
        if (fs.existsSync(folderPath)) {
            archive.directory(folderPath, folder);
        } else {
            console.error(`Folder not found: ${folderPath}`);
        }
    });

    archive.finalize();
}

// Function to send the backup file to the Discord webhook
async function sendBackupToWebhook() {
    if (!WEBHOOK_URL) return;
    const form = new FormData();
    form.append('file', fs.createReadStream(BACKUP_PATH));

    try {
        const response = await axios.post(WEBHOOK_URL, form, {
            headers: {
                ...form.getHeaders(),
            },
        });
        if (response.status === 200) {
            console.log('Backup sent successfully');
        } else {
            console.error('Error sending backup:', response.statusText);
        }
    } catch (error) {
        console.error('Error sending backup:', error.message);
    }
}

client.on("messageCreate" , async(message) => {
    if(message.author.bot) return;
    if(message.content === "backup" && message.author.id === owner[0]){
        createBackup();
        await message.react('✅');
    }
});

// Auto backup every 10 minutes
setInterval(() => {
    createBackup();
}, 600_000);

// ═══════════════════════════════════════════
// 🌐 تشغيل الموقع مع البوت
// ═══════════════════════════════════════════
require('./website.js');

// Enhanced error handling with timestamps
function logError(type, err) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${type}:`, err);
}

process.on('uncaughtException', (err) => {
    logError('UNCAUGHT_EXCEPTION', err);
    // Don't exit - keep the bot running
});
process.on('unhandledRejection', (reason, promise) => {
    logError('UNHANDLED_REJECTION', reason);
});
process.on("uncaughtExceptionMonitor", (reason) => { 
    logError('EXCEPTION_MONITOR', reason);
});
// صاحب بروجكت https://youtube.com/@nova-maker?si=35v0UO0-YTy13rA9