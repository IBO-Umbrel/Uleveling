/// <reference types="node" />

// import type TelegramBot from "node-telegram-bot-api";



interface groupData
{
    id: TelegramBot.ChatId;
    total_messages: number;
    random_reward_range: number;
    random_reward_after: number;
    random_reward_active: boolean;
    random_reward_expires_at: number;
}
interface userData
{
    key_id: number;
    id: TelegramBot.User["id"];
    group_id: groupData["id"];
    level: number;
    experience: number;
    total_messages: number;
}
interface activeUsersData
{
    user_id: userData["id"];
    group_id: groupData["id"];
    last_active_timestamp: number;
}