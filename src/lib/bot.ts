// import TelegramBot from "node-telegram-bot-api";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();



// export const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { webHook: true });
export const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);