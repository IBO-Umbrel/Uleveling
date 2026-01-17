import { bot } from "./lib/bot";
import { message } from "telegraf/filters"
import { prisma } from "./lib/prisma";
import { app } from "./lib/server";
// import { GroupUsersCreateManyInput, UsersCreateManyInput } from "../generated/prisma/models";



// constants for level up
const INITIAL_REQ_EXP = 100;
const REQ_EXP_MUL = 1.5;
// constants for exp
const TEXT_MESSAGE_EXP = 20;
const OTHER_MESSAGE_EXP = 10;
const REWARD_EXP = 150;



function escapeMarkdownV2(text: string)
{
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}



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


async function update_message_exp(id: bigint, new_exp: number, new_message_count: number)
{
    // updating exp
    const group_user = await prisma.groupUsers.update({
        data: {
            experience: new_exp,
            message_count: new_message_count
        },
        where: {
            id,
        },
    });
    // triggering level up
    const required_experience = Math.round(INITIAL_REQ_EXP * Math.pow(REQ_EXP_MUL, group_user.level - 1));
    if (new_exp >= required_experience)
    {
        await prisma.groupUsers.update({
            data: {
                level: group_user.level + 1,
                experience: new_exp - required_experience
            },
            where: {
                id,
            },
        });
        return true;
    }
    return false;
}



bot.start((ctx) =>
{
    if (ctx.chat.type === "private")
    {
        ctx.reply("Hello! Add Uleveling Bot to your Telegram group to start leveling engagement in your community.");
        return;
    }
});
bot.help((ctx) =>
{
    if (ctx.chat.type === "private")
    {
        ctx.reply("To use this bot, simply add it to your group and it will start tracking user engagement automatically.");
        return;
    }
});
bot.catch((err) =>
{
    console.log(err);
});
bot.command("enable_rewards", async (ctx) =>
{
    if (ctx.chat.type === "private")
    {
        ctx.reply("This command can be used in groups only!", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }
    const admins = await bot.telegram.getChatAdministrators(ctx.chat.id);
    const is_user_admin = admins.find(admin => admin.user.id === ctx.from.id);
    if (!is_user_admin)
    {
        ctx.reply("This command can be used by admins only!", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }

    // checking group
    let group = await prisma.groups.findUnique({
        where: {
            tg_id: ctx.chat.id
        },
        include: {
            reward: true
        }
    });
    if (!group)
    {
        group = await prisma.groups.create({
            data: {
                tg_id: ctx.chat.id,
                username: ctx.chat.type === "supergroup" ? ctx.chat.username : null,
                title: ctx.chat.type === "supergroup" ? ctx.chat.title : null
            },
            include: {
                reward: true
            }
        });
    }
    if (group.reward)
    {
        ctx.reply("Rewards are already enabled!", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }
    await prisma.rewards.create({
        data: {
            group_id: group.id
        }
    });
    ctx.reply("Bonus EXP Reward is now enabled!\n\nAppearance Rate has been set to default (20 messages). To change it, use /change_reward.", {reply_parameters: {message_id: ctx.msgId}});
});
bot.command("claim", async (ctx) =>
{
    if (ctx.chat.type === "private")
    {
        ctx.reply("This command can be used in groups only!", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }
    
    // checking groups, users, and groupUsers
    let group = await prisma.groups.findUnique({
        where: {
            tg_id: ctx.chat.id
        },
        include: {
            reward: true
        }
    });
    if (!group)
    {
        group = await prisma.groups.create({
            data: {
                tg_id: ctx.chat.id,
                username: ctx.chat.type === "supergroup" ? ctx.chat.username : null,
                title: ctx.chat.type === "supergroup" ? ctx.chat.title : null
            },
            include: {
                reward: true
            }
        });
    }
    let user = await prisma.users.findUnique({
        where: {
            tg_id: ctx.from.id
        }
    });
    if (!user)
    {
        user = await prisma.users.create({
            data: {
                tg_id: ctx.from.id,
                username: ctx.from.username,
                name: ctx.from.first_name,
                is_premium: ctx.from.is_premium
            }
        });
    }
    const group_user = await prisma.groupUsers.findUnique({
        where: {
            group_id_user_id: {
                group_id: group.id,
                user_id: user.id
            }
        }
    });

    // check conditions
    if (!group_user)
    {
        ctx.reply("You have no recorded activity yet.", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }
    if (!group.reward)
    {
        ctx.reply("Random Rewards is not enabled in this group! Use /enable_rewards to enable it.", {reply_parameters: {message_id: ctx.msgId}})
        return;
    }
    if (!group.reward.active)
    {
        ctx.reply("There is no active reward at the moment.", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }
    if (group.reward.expires_at < Date.now())
    {
        ctx.reply("The reward period has expired.", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }

    // grant random reward
    const has_claimed_reward = await prisma.claimedRewards.findUnique({
        where: {
            reward_id_group_user_id: {
                reward_id: group.reward.id,
                group_user_id: group_user.id
            }
        }
    });
    if (has_claimed_reward)
    {
        ctx.reply("You have already claimed the current reward.", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }

    // triggering level up
    const required_experience = Math.round(INITIAL_REQ_EXP * Math.pow(REQ_EXP_MUL, group_user.level - 1));
    const new_exp = Number(group_user.experience) + REWARD_EXP;
    if (new_exp >= required_experience)
    {
        await prisma.$transaction([
            prisma.claimedRewards.create({
                data: {
                    reward_id: group.reward.id,
                    group_user_id: group_user.id
                }
            }),
            prisma.groupUsers.update({
                data: {
                    experience: new_exp - required_experience,
                    level: group_user.level + 1
                },
                where: {
                    id: group_user.id
                }
            })
        ]);
        await ctx.react(["⚡", "🎉"], true);
        const reply_name = escapeMarkdownV2(ctx.from.username ? "@" + ctx.from.username : ctx.from.first_name);
        const reply_message = "Congratulations, " + reply_name + "\\! You have successfully claimed your bonus EXP, and you are now *level " + (group_user.level + 1) + "\\!* 🎉";
        await ctx.replyWithMarkdownV2(reply_message, {reply_parameters: {message_id: ctx.msgId}});
    }
    else
    {
        await prisma.$transaction([
            prisma.claimedRewards.create({
                data: {
                    reward_id: group.reward.id,
                    group_user_id: group_user.id
                }
            }),
            prisma.groupUsers.update({
                data: {
                    experience: new_exp
                },
                where: {
                    id: group_user.id
                }
            })
        ]);
        ctx.reply("You have successfully claimed your bonus EXP! 🎉", {reply_parameters: {message_id: ctx.msgId}});
    }
});
bot.command("level", async (ctx) =>
{
    if (ctx.chat.type === "private")
    {
        ctx.reply("This command can be used in groups only!", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }

    // checking groups, users, and groupUsers
    let group = await prisma.groups.findUnique({
        where: {
            tg_id: ctx.chat.id
        }
    });
    if (!group)
    {
        group = await prisma.groups.create({
            data: {
                tg_id: ctx.chat.id,
                username: ctx.chat.type === "supergroup" ? ctx.chat.username : null,
                title: ctx.chat.type === "supergroup" ? ctx.chat.title : null
            }
        });
    }
    let user = await prisma.users.findUnique({
        where: {
            tg_id: ctx.from.id
        }
    });
    if (!user)
    {
        user = await prisma.users.create({
            data: {
                tg_id: ctx.from.id,
                username: ctx.from.username,
                name: ctx.from.first_name,
                is_premium: ctx.from.is_premium
            }
        });
    }
    const group_user = await prisma.groupUsers.findUnique({
        where: {
            group_id_user_id: {
                group_id: group.id,
                user_id: user.id
            }
        }
    });

    // check conditions
    if (!group_user)
    {
        ctx.reply("You have no recorded activity yet.", {reply_parameters: {message_id: ctx.msgId}});
        return;
    }
    await ctx.react("👀", true);
    ctx.replyWithMarkdownV2("You are *level " + group_user.level + "* with *" + group_user.message_count + " messages*.");
});



// group messages
bot.on("message", async (ctx) =>
{
    // DMs
    if (ctx.chat.type === "private")
    {
        return;
    }
    // console.log(ctx.text);

    // checking groups, users, and groupUsers
    let group = await prisma.groups.findUnique({
        where: {
            tg_id: ctx.chat.id
        },
        include: {
            reward: true
        }
    });
    if (!group)
    {
        group = await prisma.groups.create({
            data: {
                tg_id: ctx.chat.id,
                username: ctx.chat.type === "supergroup" ? ctx.chat.username : null,
                title: ctx.chat.type === "supergroup" ? ctx.chat.title : null
            },
            include: {
                reward: true
            }
        });
    }
    let user = await prisma.users.findUnique({
        where: {
            tg_id: ctx.from.id
        }
    });
    if (!user)
    {
        user = await prisma.users.create({
            data: {
                tg_id: ctx.from.id,
                username: ctx.from.username,
                name: ctx.from.first_name,
                is_premium: ctx.from.is_premium
            }
        });
    }
    let group_user = await prisma.groupUsers.findUnique({
        where: {
            group_id_user_id: {
                group_id: group.id,
                user_id: user.id
            }
        }
    });
    if (!group_user)
    {
        group_user = await prisma.groupUsers.create({
            data: {
                group_id: group.id,
                user_id: user.id
            }
        });
    }

    // increasing exp
    const exp = ctx.msg.has("text") ? TEXT_MESSAGE_EXP : OTHER_MESSAGE_EXP;
    const did_level_up = await update_message_exp(group_user.id, Number(group_user.experience) + exp, Number(group_user.message_count) + 1);
    if (did_level_up)
    {
        // letting user know they leveled up
        await ctx.react("⚡", true);
        const reply_name = escapeMarkdownV2(ctx.from.username ? "@" + ctx.from.username : ctx.from.first_name);
        const reply_message = "Congratulations, " + reply_name + "\\! You are now *level " + (group_user.level + 1) + "\\!* 🎉";
        await ctx.replyWithMarkdownV2(reply_message, {reply_parameters: {message_id: ctx.msgId}});
    }

    // checking rewards
    if (!group.reward)
        return;
    if (group.reward.active && group.reward.expires_at <= Date.now())
    {
        // deactivating reward
        const new_appearance_after = Math.floor(Math.random() * (group.reward.appearance_range * 0.5) + group.reward.appearance_range);
        await prisma.$transaction([
            prisma.rewards.update({
                data: {
                    active: false,
                    appearance_after: new_appearance_after
                },
                where: {
                    group_id: group.id
                }
            }),
            prisma.claimedRewards.deleteMany({
                where: {
                    reward_id: group.reward.id
                }
            })
        ]);
        return;
    }
    // making sure that appearance rate won't get decreased when the rewars is active
    if (group.reward.active)
        return;
    // decreasing reward appearance_after
    const reward = await prisma.rewards.update({
        data: {
            appearance_after: group.reward.appearance_after - 1
        },
        where: {
            id: group.reward.id
        }
    });
    if (reward.appearance_after === 0)
    {
        // activating reward
        await prisma.rewards.update({
            data: {
                active: true,
                expires_at: Date.now() + (20 * 60 * 1000)
            },
            where: {
                id: reward.id
            }
        });
        await ctx.react("⚡", true);
        await ctx.replyWithSticker("CAACAgIAAyEFAASLO6_0AAIFf2lrwjd0FR_S06urhpE1Q7XanoipAAKMCwACLw_wBoRsyFANo_xWOAQ");
        await ctx.reply("A bonus EXP is being dropped! Active users may receive bonus exp points.\n\nTap /claim to receive your exp!");
    }
});
bot.on(message("story"), (ctx) =>
{
    ctx.react("👍");
});
// bot.on(message("sticker"), (ctx) =>
// {
//     console.log(ctx.msg.sticker.file_id);
// });



// when bot is added group data will be created or a welcome message for new members
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
                await prisma.groups.create({
                    data: {
                        tg_id: ctx.chat.id,
                        username: ctx.chat.type === "supergroup" ? ctx.chat.username : null,
                        title: ctx.chat.type === "supergroup" ? ctx.chat.title : null
                    }
                });
                // create admins in database
                const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
                
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



async function start()
{
    app.use(await bot.createWebhook({ domain: process.env.PUBLIC_URL! }));
    app.listen(process.env.PORT, () => console.log("Listening on port", process.env.PORT));
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
}
start();