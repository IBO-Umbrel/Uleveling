// use _ casing instead of camelCase
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";



dotenv.config();



const token = process.env.TELEGRAM_TOKEN;
if (!token)
{
    console.error("Missing TELEGRAM_TOKEN in environment");
    process.exit(1);
}
const bot = new TelegramBot(token,
{
    polling: true,
});





interface userData
{
    level: number;
    experience: number;
    total_messages: number;
    last_message_timestamp: number;
}

interface groupData
{
    total_messages: number;
    active_users: Set<number>;
}
interface DataStore
{
    users: Map<number, userData>;
    groups: Map<number, groupData>;
}
const data: DataStore = {
    users: new Map<number, userData>(),
    groups: new Map<number, groupData>()
};


const LEVEL_UP_EXPERIENCE = 100;
const LEVEL_EXPERIENCE_MULTIPLIER = 1.5;
const MESSAGE_EXPERIENCE = 10;
// const REWARD_EXPERIENCE = 50;
// const LEVEL_UP_NOTIFICATION_DELAY_MS = 5 * 60 * 1000; // 5 minutes (not used currently)



function save_data()
{
    // save data to data.json
    const data_to_save = {
        users: Array.from(data.users.entries()),
        groups: Array.from(data.groups.entries()).map(([group_id, group]) => [group_id, { ...group, active_users: Array.from(group.active_users) }]),
    };
    fs.writeFileSync("data.json", JSON.stringify(data_to_save));
    // clear data from memory
    data.users.clear();
    data.groups.clear();
}
function load_data()
{
    // load data from data.json
    if (fs.existsSync("data.json"))
    {
        const raw_data = fs.readFileSync("data.json", "utf-8");
        const parsed_data = JSON.parse(raw_data);
        data.users = new Map<number, userData>(parsed_data.users);
        data.groups = new Map<number, groupData>(parsed_data.groups.map(([group_id, group]: [number, groupData]) => [group_id, { ...group, active_users: new Set<number>(group.active_users) }]));
    }
}



function handle_start_command(chat_id: number)
{
    const welcome_message = "Hello! Add Uleveling Bot to your Telegram group to start leveling engagement in your community.";
    bot.sendMessage(chat_id, welcome_message);
}
function handle_help_command(chat_id: number)
{
    const help_message = "To use this bot, simply add it to your group and it will start tracking user engagement automatically.";
    bot.sendMessage(chat_id, help_message);
}
function handle_unknown_command(chat_id: number)
{
    const unknown_message = "Sorry, I didn't understand that command. Type /help for assistance.";
    bot.sendMessage(chat_id, unknown_message);
}
function handle_error(chat_id: number, error_message: string)
{
    bot.sendMessage(chat_id, `Error: ${error_message}`);
}
function handle_group_message(chat_id: number, user_id: number, user_name: string, message: string)
{
    console.log(`Received message from ${user_id}: ${message}`);

    load_data();

    // Update group data
    let group = data.groups.get(chat_id);
    if (!group)
    {
        group = { total_messages: 0, active_users: new Set<number>() };
        data.groups.set(chat_id, group);
    }
    group.total_messages += 1;


    // Update user data
    let user = data.users.get(user_id);
    if (!user)
    {
        user = { level: 1, experience: 0, total_messages: 0, last_message_timestamp: Date.now() };
        data.users.set(user_id, user);
    }
    user.total_messages += 1;
    user.experience += MESSAGE_EXPERIENCE;
    user.last_message_timestamp = Date.now();


    // Check for level up
    const required_experience = Math.floor(LEVEL_UP_EXPERIENCE * Math.pow(LEVEL_EXPERIENCE_MULTIPLIER, user.level - 1));
    if (user.experience >= required_experience)
    {
        user.level += 1;
        user.experience -= required_experience;
        bot.sendMessage(chat_id, `Congratulations, ${user_name}! You are now level ${user.level}! 🎉`);
    }
    save_data();
}
function handle_level_command(chat_id: number, user_id: number, message_id: number)
{
    load_data();
    const user = data.users.get(user_id);
    if (user)
    {
        bot.sendMessage(chat_id, `You are level ${user.level} with ${user.experience} XP.`, { reply_to_message_id: message_id });
        return;
    }
    bot.sendMessage(chat_id, "You have no recorded activity yet.", { reply_to_message_id: message_id });
    save_data();
}



// handle commands & handle group messages for engagement tracking
bot.on("message", (msg) =>
{
    try
    {
        const chat_id = msg.chat.id;
        if (!msg.text) return;
        const text = msg.text.trim();

        
        if (text === "/level" || text === "/level@ulevelingbot")
        {
            handle_level_command(chat_id, msg.from?.id ?? 0, msg.message_id);
            return;
        }
        if (msg.chat.type === "group" || msg.chat.type === "supergroup")
        {
            handle_group_message(chat_id, msg.from?.id ?? 0, msg.from?.username ? "@" + msg.from?.username : (msg.from?.first_name ?? ""), text);
            return;
        }
        if (text === "/start" || text === "/start@ulevelingbot")
        {
            handle_start_command(chat_id);
            return;
        }
        if (text === "/help" || text === "/help@ulevelingbot")
        {
            handle_help_command(chat_id);
            return;
        }
        handle_unknown_command(chat_id);
    }
    catch (error)
    {
        const chat_id = msg.chat.id;
        handle_error(chat_id, (error as Error).message);
    }
});


// handle new group additions
bot.on("new_chat_members", (msg) =>
{
    try
    {
        const chat_id = msg.chat.id;
        const new_members = msg.new_chat_members;
        new_members?.forEach((member) =>
        {
            if (member.is_bot && member.username === "ulevelingbot") // replace with your bot's username
            {
                bot.sendMessage(chat_id, "Hello everyone! I'm Uleveling Bot. I'll help track engagement in this group.");
            }
        });
    }
    catch (error)
    {
        const chat_id = msg.chat.id;
        handle_error(chat_id, (error as Error).message);
    }
});




bot.on("polling_error", (err) => console.error("Polling error", err));
console.log("Telegram bot started");