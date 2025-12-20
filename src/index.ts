/* eslint-disable @typescript-eslint/no-unused-vars */
// use _ casing instead of camelCase
// import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import Database from "./Database";



// dotenv.config();



const token = process.env.TELEGRAM_TOKEN;
if (!token)
{
    console.error("Missing TELEGRAM_TOKEN in environment");
    process.exit(1);
}
// creating telegram bot
const bot = new TelegramBot(token,
{
    polling: true,
});
const db = new Database();



function handle_start_command(chat_id: TelegramBot.ChatId)
{
    const welcome_message = "Hello! Add Uleveling Bot to your Telegram group to start leveling engagement in your community.";
    bot.sendMessage(chat_id, welcome_message);
}
function handle_help_command(chat_id: TelegramBot.ChatId)
{
    const help_message = "To use this bot, simply add it to your group and it will start tracking user engagement automatically.";
    bot.sendMessage(chat_id, help_message);
}
function handle_unknown_command(chat_id: TelegramBot.ChatId)
{
    const unknown_message = "Sorry, I didn't understand that command. Type /help for assistance.";
    bot.sendMessage(chat_id, unknown_message);
}
function handle_error(chat_id: TelegramBot.ChatId, error_message: string)
{
    bot.sendMessage(chat_id, `Error: ${error_message}`);
}
async function handle_welcome_message(chat_id: TelegramBot.ChatId, user_name: string)
{
    const welcome_messages = [
        "Welcome, " + user_name + "! Glad to have you here.",
        "Hey " + user_name + ", welcome aboard!",
        user_name + "just landed! Welcome!"
    ];
    await bot.sendMessage(chat_id, welcome_messages[Math.floor(Math.random() * welcome_messages.length)]);
}



async function handle_level_up(chat_id: TelegramBot.ChatId, user_name: string, level: userData["level"])
{
    await bot.sendMessage(chat_id, `Congratulations, ${user_name}! You are now level ${level}! 🎉`);
}
async function handle_group_message(chat_id: TelegramBot.ChatId, user_id: userData["id"], user_name: string, message: string)
{
    console.log(`Received message from  ${chat_id}--${user_id}: ${message}`);

    // Update group data
    let group = await db.get_group(chat_id);
    if (!group)
    {
        group = await db.create_group(chat_id);
    }


    // Update user data
    let user = await db.get_user(user_id, chat_id);
    if (!user)
    {
        user = await db.create_user(user_id, chat_id);
    }


    // Add message experience
    const is_leveled_up = await db.add_message_experience(user.id, group.id);
    // Check for level up
    if (is_leveled_up)
    {
        const updated_user = await db.get_user(user.id, group.id);
        if (updated_user)
        {
            await handle_level_up(group.id, user_name, updated_user.level);
        }
    }


    // check if reward can be activated
    const updated_random_reward_after = await db.reduce_random_reward_after(group.id); // reduces by 1
    if (!group.random_reward_active && updated_random_reward_after === 0)
    {
        const now = Date.now();
        if (now >= group.random_reward_expires_at)
        {
            // activate reward
            await db.activate_random_reward(group.id);

            // notify group
            const mes_res = await bot.sendSticker(group.id, "AnimatedSticker.tgs");
            await bot.sendMessage(group.id, "A random bonus reward is being dropped! Active users may receive bonus experience points.\n\nTap /claim to receive your reward!", { reply_to_message_id: mes_res.message_id });
        }
    }
}
async function handle_level_command(chat_id: number, user_id: number, message_id: number)
{
    const user = await db.get_user(user_id, chat_id);
    if (user)
    {
        bot.sendMessage(chat_id, `You are level ${user.level} with ${user.experience} XP.`, { reply_to_message_id: message_id });
        return;
    }
    bot.sendMessage(chat_id, "You have no recorded activity yet.", { reply_to_message_id: message_id });
}
async function handle_claim_command(chat_id: number, user_id: number, message_id: number, user_name: string)
{
    // check user & group data
    const user = await db.get_user(user_id, chat_id);
    if (!user)
    {
        bot.sendMessage(chat_id, "You have no recorded activity yet.", { reply_to_message_id: message_id });
        return;
    }
    const group = await db.get_group(chat_id);
    if (!group)
    {
        bot.sendMessage(chat_id, "Group data not found.", { reply_to_message_id: message_id });
        return;
    }
    if (!group.random_reward_active)
    {
        bot.sendMessage(chat_id, "There is no active bonus reward at the moment.", { reply_to_message_id: message_id });
        return;
    }


    // check for expiration
    const now = Date.now();
    if (now >= group.random_reward_expires_at)
    {
        // deactivate reward
        await db.deactivate_random_reward(group.id);
        bot.sendMessage(chat_id, "The bonus reward period has expired.", { reply_to_message_id: message_id });
        return;
    }


    // grant random reward
    const has_claimed = await db.has_claimed_reward(user.key_id);
    if (has_claimed)
    {
        bot.sendMessage(chat_id, "You have already claimed the current random reward.", { reply_to_message_id: message_id });
        return;
    }
    const is_leveled_up = await db.claim_reward(user.id, group.id);
    await bot.sendMessage(chat_id, "You have successfully claimed your random reward! 🎉", { reply_to_message_id: message_id });


    // Check for level up
    if (is_leveled_up)
    {
        const updated_user = await db.get_user(user.id, group.id);
        if (updated_user)
        {
            await handle_level_up(group.id, user_name, updated_user.level);
        }
    }
}




// handle commands & handle group messages for engagement tracking
bot.on("message", (msg) =>
{
    try
    {
        if (!msg.text) return;
        const text = msg.text.trim();
        const chat_id = msg.chat.id;
        const user_id = msg.from?.id ?? 0;
        const user_name = msg.from?.username ? "@" + msg.from?.username : (msg.from?.first_name ?? "");

        
        if (msg.chat.type === "group" || msg.chat.type === "supergroup")
        {
            if (text === "/level" || text === "/level@ulevelingbot")
            {
                handle_level_command(chat_id, user_id, msg.message_id);
                return;
            }
            if (text === "/claim" || text === "/claim@ulevelingbot")
            {
                handle_claim_command(chat_id, user_id, msg.message_id, user_name);
                return;
            }
            handle_group_message(chat_id, user_id, user_name, text);
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
        new_members?.forEach(async (member) =>
        {
            if (member.is_bot && member.username === "ulevelingbot") // replace with your bot's username
            {
                await bot.sendMessage(chat_id, "Hello everyone! I'm Uleveling Bot. I'll help track engagement in this group.");
            }
            else
            {
                const user_name = member.username ? "@" + member.username : (member.first_name ?? "");
                await handle_welcome_message(chat_id, user_name);
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