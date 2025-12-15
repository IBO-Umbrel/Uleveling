/* eslint-disable @typescript-eslint/no-unused-vars */
// use _ casing instead of camelCase
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Pool } from "pg";



dotenv.config();



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


// connecting to postgres
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
async function create_tables()
{
    await pool.query(`
        CREATE TABLE IF NOT EXISTS groups (
            id BIGINT PRIMARY KEY,
            total_messages BIGINT NOT NULL default 0,
            random_reward integer NOT NULL default 20
        );
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT,
            group_id BIGINT REFERENCES groups(id),
            level INT NOT NULL default 1,
            experience INT NOT NULL,
            total_messages BIGINT NOT NULL default 0,
            last_message_timestamp BIGINT NOT NULL,
            PRIMARY KEY (id, group_id)
        );
        CREATE TABLE IF NOT EXISTS active_users (
            user_id BIGINT REFERENCES users(id),
            group_id BIGINT REFERENCES groups(id),
            last_active_timestamp BIGINT NOT NULL,
            PRIMARY KEY (user_id, group_id)
        );
        CREATE TABLE IF NOT EXISTS rewards (
            id BIGSERIAL PRIMARY KEY,
            group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
            reward_number INTEGER NOT NULL,
            created_at BIGINT NOT NULL,
            UNIQUE (group_id, reward_number)
        );
        CREATE INDEX idx_rewards_group_id ON rewards(group_id);
        CREATE TABLE IF NOT EXISTS claimed_rewards (
            id serial PRIMARY KEY,
            rewards_id BIGINT REFERENCES rewards(id)
        );
        CREATE TABLE claimed_rewards (
            id BIGSERIAL PRIMARY KEY,
            group_id BIGINT NOT NULL,
            user_id BIGINT NOT NULL,
            reward_id BIGINT NOT NULL,

            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,

            UNIQUE (group_id, user_id, reward_id)
        );
        CREATE INDEX idx_claimed_rewards_group ON claimed_rewards(group_id);
        CREATE INDEX idx_claimed_rewards_user ON claimed_rewards(user_id);
    `);
}
create_tables().catch((err) => console.error("Error creating tables", err));


// async function get_user(id: number): Promise<userData>
// {
//     const result = await pool.query(
//         "SELECT * FROM users WHERE id = $1",
//         [id]
//     );
//     return result.rows[0];
// }
async function get_group_user(id: number, group_id: number): Promise<userData>
{
    const result = await pool.query(
        "SELECT * FROM users WHERE id = $1 and group_id = $2",
        [id, group_id]
    );
    return result.rows[0];
}
async function update_group_user(user: userData)
{
    const {id, group_id, level, experience, total_messages, last_message_timestamp} = user;
    await pool.query(
        `
        update users set
            level = $3,
            experience = $4,
            total_messages = $5,
            last_message_timestamp = $6
        WHERE id = $1 and group_id = $2`,
        [id, group_id, level, experience, total_messages, last_message_timestamp]
    );
}
async function create_group_user(user: userData)
{
    const {id, group_id, level, experience, total_messages, last_message_timestamp} = user;
    await pool.query(
        `
        INSERT INTO users (
            id,
            group_id,
            level,
            experience,
            total_messages,
            last_message_timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, group_id, level, experience, total_messages, last_message_timestamp]
    );
}
async function get_group(id: number): Promise<groupData>
{
    const result = await pool.query(
        "SELECT * FROM groups WHERE id = $1",
        [id]
    );
    return result.rows[0];
}
async function create_group(id: number)
{
    await pool.query(
        `
        INSERT INTO groups (
            id
        )
        VALUES ($1)`,
        [id]
    );
}
async function update_group_messages(id: number, total_messages: number)
{
    await pool.query(
        `
        update groups set
            total_messages = $2
        WHERE id = $1`,
        [id, total_messages]
    );
}
async function update_group_reward(id: number, random_reward: number)
{
    await pool.query(
        `
        update groups set
            random_reward = $2
        WHERE id = $1`,
        [id, random_reward]
    );
}
async function create_reward(group_id: number)
{
    await pool.query(`
        WITH next_number AS (
        SELECT COALESCE(MAX(reward_number), 0) + 1 AS rn
        FROM rewards
        WHERE group_id = $1
        )
        INSERT INTO rewards (group_id, reward_number)
        SELECT $1, rn
        FROM next_number`,
        [group_id]
    );
}
async function claim_reward(group_id: number, user_id: number, reward_id: number)
{
    await pool.query(`
        INSERT INTO claimed_rewards (group_id, user_id, reward_id)
        VALUES ($1, $2, $3)
        `,
        [group_id, user_id, reward_id]
    );
}





const LEVEL_UP_EXPERIENCE = 100;
const LEVEL_EXPERIENCE_MULTIPLIER = 1.5;
const MESSAGE_EXPERIENCE = 10;
const REWARD_EXPERIENCE = 110;
// const random_reward_after_messages = 20;
// const LEVEL_UP_NOTIFICATION_DELAY_MS = 5 * 60 * 1000; // 5 minutes (not used currently)



function get_random_number(min: number, max: number)
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
function handle_level_up(chat_id: number, user_name: string, user: userData)
{
    const required_experience = Math.floor(LEVEL_UP_EXPERIENCE * Math.pow(LEVEL_EXPERIENCE_MULTIPLIER, user.level - 1));
    if (user.experience >= required_experience)
    {
        user.level += 1;
        user.experience -= required_experience;
        bot.sendMessage(chat_id, `Congratulations, ${user_name}! You are now level ${user.level}! 🎉`);
    }
    return user;
}
function handle_claim_command(char_id: number, user_id: number)
{

}
async function handle_random_reward(group_id: number)
{
    const group = await get_group(group_id);

    if (group.random_reward === 0)
    {
        bot.sendAnimation(group_id, "reward.gif", {caption: "Bonus XP is dropping!\n\nCongrats! 110 XP is being dropped!\nUse /claim to claim the it!"});
        group.random_reward = get_random_number(21, 31);
    }
    group.random_reward! -= 1; 
    await update_group_reward(group_id, group.random_reward!)
}
async function handle_group_message(chat_id: number, user_id: number, user_name: string, message: string)
{
    console.log(`Received message from  ${chat_id}--${user_id}: ${message}`);

    // Update group data
    let group = await get_group(chat_id)
    let is_new_group = false;
    if (!group)
    {
        group = {id: chat_id, total_messages: 0 };
        is_new_group = true;
    }
    group.total_messages = +group.total_messages;
    group.total_messages += 1;
    if (is_new_group)
        await create_group(chat_id);
    else
    {
        await update_group_messages(chat_id, group.total_messages);
        handle_random_reward(chat_id);
    }


    // Update user data
    let user = await get_group_user(user_id, chat_id);
    // console.log
    let is_new_user = false;
    if (!user)
    {
        user = {id: user_id, group_id: chat_id, level: 1, experience: 0, total_messages: 0, last_message_timestamp: Date.now() };
        is_new_user = true;
    }
    user.total_messages = +user.total_messages
    user.total_messages += 1;
    user.experience += MESSAGE_EXPERIENCE;
    user.last_message_timestamp = Date.now();


    // Check for level up
    user = handle_level_up(chat_id, user_name, user)
    if (is_new_user)
    {
        await create_group_user(user);
        return;
    }
    await update_group_user(user);
}
async function handle_level_command(chat_id: number, user_id: number, message_id: number)
{
    const user = await get_group_user(user_id, chat_id);
    if (user)
    {
        bot.sendMessage(chat_id, `You are level ${user.level} with ${user.experience} XP.`, { reply_to_message_id: message_id });
        return;
    }
    bot.sendMessage(chat_id, "You have no recorded activity yet.", { reply_to_message_id: message_id });
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