import { bot } from "./lib/bot";
import { message } from "telegraf/filters"
import { prisma } from "./lib/prisma";
import { GroupUsersCreateManyInput, UsersCreateManyInput } from "../generated/prisma/models";



async function handle_welcome_message(chat_id: number, user_name: string)
{
    const welcome_messages = [
        "Welcome, " + user_name + "! Glad to have you here.",
        "Hey " + user_name + ", welcome aboard!",
        user_name + " just landed! Welcome!"
    ];
    await bot.telegram.sendMessage(chat_id, welcome_messages[Math.floor(Math.random() * welcome_messages.length)]);
}
async function handle_leave_message(chat_id: number, user_name: string)
{
    const farewell_messages = [
        "Goodbye, " + user_name + "! We'll miss you.",
        "Sad to see you go, " + user_name + ". Take care!",
        user_name + " has left the chat. Farewell!"
    ];
    await bot.telegram.sendMessage(chat_id, farewell_messages[Math.floor(Math.random() * farewell_messages.length)]);
}



bot.start((ctx) =>
{
    ctx.reply("Hello! Add Uleveling Bot to your Telegram group to start leveling engagement in your community.");
});
bot.help((ctx) =>
{
    ctx.reply("To use this bot, simply add it to your group and it will start tracking user engagement automatically.");
});
bot.catch((err) =>
{
    console.log(err);
});



bot.on(message("text"), (ctx) =>
{
    console.log(ctx.message);
    
});
bot.on(message("new_chat_members"), async (ctx) =>
{
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup")
    {
        for (const member of ctx.msg.new_chat_members)
        {
            // create group in database
            if (member.is_bot && member.id === ctx.botInfo.id)
            {
                // create group in database
                const existing_group = await prisma.groups.findUnique({
                    where: {
                        tg_id: ctx.chat.id
                    }
                });
                if (existing_group)
                {
                    continue;
                }
                const new_group = await prisma.groups.create({
                    data: {
                        tg_id: ctx.chat.id,
                        username: ctx.chat.type === "supergroup" ? ctx.chat.username : null,
                        title: ctx.chat.type === "supergroup" ? ctx.chat.title : null
                    }
                });
                // create admins in database
                const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
                const new_users = await prisma.users.createManyAndReturn({
                    data: admins.map(admin => {
                        const data: UsersCreateManyInput = {
                            tg_id: admin.user.id,
                            username: admin.user.username,
                            name: admin.user.first_name,
                            is_premium: admin.user.is_premium
                        };
                        return data;
                    })
                });
                await prisma.groupUsers.createMany({
                    data: new_users.map((admin) =>
                    {
                        const data: GroupUsersCreateManyInput = {
                            group_id: new_group.id,
                            user_id: admin.id,
                            is_admin: true
                        };
                        return data;
                    })
                });
                
                const is_bot_admin = admins.find(admin => admin.user.id === ctx.botInfo.id);
                await ctx.reply(`
                    Hello everyone! I'm Uleveling Bot. I'll help track engagement in this group.${is_bot_admin ? "" : "\n\nPlease make me an admin to enable full functionality."}

                    useful commands:
                    -- /level
                    -- /claim
                    `);
                continue;
            }
            await handle_welcome_message(ctx.chat.id, member.username ?? member.first_name);
        }
    }
});
bot.on(message("left_chat_member"), async (ctx) =>
{
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup")
    {
        const member = ctx.msg.left_chat_member;
        if (!member.is_bot)
        {
            await prisma.users.delete({
                where: {
                    tg_id: member.id
                }
            });
        }
        await handle_leave_message(ctx.chat.id, member.username ? "@" + member.username : member.first_name);
    }
});



bot.launch(() => console.log("Bot started..."));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))