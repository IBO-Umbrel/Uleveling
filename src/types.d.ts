/// <reference types="node" />

// import type TelegramBot from "node-telegram-bot-api";



interface groupData
{
    id: TelegramBot.ChatId;
    username?: string | null;
    total_messages: number;
    random_reward_range: number;
    random_reward_after: number;
    random_reward_active: boolean;
    random_reward_expires_at: number;
}
interface userData
{
    key_id: number;
    username?: string | null;
    id: TelegramBot.User["id"];
    group_id: groupData["id"];
    level: number;
    experience: number;
    total_messages: number;
}
interface privateChatData
{
    id: number;
    user_id: TelegramBot.User["id"];
    username?: string | null;
}
interface notificationData
{
    id: number;
    message: string;
    scheduled_at: number;
    expired: boolean;
}