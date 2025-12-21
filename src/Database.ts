import { Pool } from "pg";


// function get_random_number(min: number, max: number)
// {
//     return Math.floor(Math.random() * (max - min + 1)) + min;
// }


class Database
{
    private pool: Pool;
    public INITIAL_LEVEL_EXPERIENCE = 100;
    public LEVEL_EXPERIENCE_MULTIPLIER = 1.5;
    public MESSAGE_EXPERIENCE = 10;
    public REWARD_EXPERIENCE = 110;


    constructor()
    {
        // connecting to postgres
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
    async close()
    {
        await this.pool.end();
    }


    async create_tables()
    {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id BIGINT PRIMARY KEY,
                total_messages BIGINT NOT NULL default 0,
                random_reward_range int NOT NULL default 20,
                random_reward_after int NOT NULL default 20,
                random_reward_active BOOLEAN NOT NULL default FALSE,
                random_reward_expires_at BIGINT NOT NULL default 0
            );
            CREATE TABLE IF NOT EXISTS users (
                key_id BIGSERIAL PRIMARY KEY,
                id BIGINT,
                group_id BIGINT REFERENCES groups(id),
                level INT NOT NULL default 1,
                experience INT NOT NULL default 0,
                total_messages BIGINT NOT NULL default 0
            );
            CREATE TABLE IF NOT EXISTS rewards (
                id SERIAL PRIMARY KEY,
                key_id BIGINT REFERENCES users(key_id)
            );
            create table IF NOT EXISTS private_chats (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGSERIAL PRIMARY KEY,
                message TEXT NOT NULL,
                scheduled_at BIGINT NOT NULL DEFAULT 0,
                expired BOOLEAN NOT NULL default FALSE
            );
        `);
    }


    async get_user(user_id: userData["id"], group_id: groupData["id"]): Promise<userData>
    {
        const result = await this.pool.query(
            "SELECT * FROM users WHERE id = $1 and group_id = $2",
            [user_id, group_id]
        );
        return result.rows[0];
    }


    async create_user(user_id: userData["id"], group_id: groupData["id"]): Promise<userData>
    {
        const result = await this.pool.query(
            `
            INSERT INTO users (
                id,
                group_id
            )
            VALUES ($1, $2) returning *`,
            [user_id, group_id]
        );
        return result.rows[0];
    }


    async get_group(group_id: groupData["id"]): Promise<groupData>
    {
        const result = await this.pool.query(
            "SELECT * FROM groups WHERE id = $1",
            [group_id]
        );
        return result.rows[0];
    }


    async create_group(group_id: groupData["id"]): Promise<groupData>
    {
        const result = await this.pool.query(
            `
            INSERT INTO groups (
                id
            )
            VALUES ($1) returning *`,
            [group_id]
        );
        return result.rows[0];
    }


    async reduce_random_reward_after(group_id: groupData["id"]): Promise<number>
    {
        const result = await this.pool.query(
            `
            UPDATE groups
            SET random_reward_after = random_reward_after - 1
            WHERE id = $1 RETURNING random_reward_after`,
            [group_id]
        );
        return result.rows[0].random_reward_after;
    }


    async activate_random_reward(group_id: groupData["id"])
    {
        const new_expires_at = Date.now() + 10 * 60 * 1000; // 10 minutes from now
        await this.pool.query(
            `
            UPDATE groups SET
                random_reward_active = TRUE,
                random_reward_expires_at = $2
            WHERE id = $1 AND random_reward_active = $3`,
            [group_id, new_expires_at, false]
        );
    }


    async deactivate_random_reward(group_id: groupData["id"])
    {
        const client = await this.pool.connect();

        try
        {
            await client.query("BEGIN");
            await client.query(
                `
                UPDATE groups SET
                    random_reward_active = FALSE,
                    random_reward_expires_at = 0,
                    random_reward_after = FLOOR(RANDOM() * (random_reward_range * 0.5) + random_reward_range)
                WHERE id = $1 and random_reward_active = $2`,
                [group_id, true]
            );
            await client.query(
                `
                DELETE FROM rewards
                WHERE key_id IN (
                    SELECT key_id FROM users WHERE group_id = $1
                )`,
                [group_id]
            );
            await client.query("COMMIT");
        }
        catch (error)
        {
            await client.query("ROLLBACK");
            throw error;
        }
        finally
        {
            client.release();
        }
    }


    async trigger_level_up(user_id: userData["id"], group_id: groupData["id"]): Promise<boolean>
    {
        const user = await this.get_user(user_id, group_id);
        const required_experience = this.INITIAL_LEVEL_EXPERIENCE * Math.pow(this.LEVEL_EXPERIENCE_MULTIPLIER, user.level - 1);
        if (user.experience >= required_experience)
        {
            await this.pool.query(
                `
                UPDATE users
                SET level = level + 1,
                    experience = experience - $3
                WHERE id = $1 AND group_id = $2`,
                [user_id, group_id, Math.round(required_experience)]
            );
            return true;
        }
        return false;
    }


    async add_message_experience(user_id: userData["id"], group_id: groupData["id"]): Promise<boolean>
    {
        await this.pool.query(
            `
            UPDATE users
            SET experience = experience + $3,
                total_messages = total_messages + 1
            WHERE id = $1 AND group_id = $2`,
            [user_id, group_id, this.MESSAGE_EXPERIENCE]
        );
        return await this.trigger_level_up(user_id, group_id);
    }


    async has_claimed_reward(key_id: userData["key_id"]): Promise<boolean>
    {
        const result = await this.pool.query(
            `
            SELECT * FROM rewards
            WHERE key_id = $1`,
            [key_id]
        );
        return result.rows.length > 0;
    }


    async claim_reward(user_id: userData["id"], group_id: groupData["id"])
    {
        const user = await this.get_user(user_id, group_id);
        const client = await this.pool.connect();

        try
        {
            await client.query("BEGIN");

            // record reward claim
            await client.query(
                `
                INSERT INTO rewards (key_id)
                VALUES ($1)`,
                [user.key_id]
            );

            // grant reward experience
            await client.query(
                `
                UPDATE users
                SET experience = experience + $3
                WHERE id = $1 AND group_id = $2`,
                [user_id, group_id, this.REWARD_EXPERIENCE]
            );
            await client.query("COMMIT");
            return await this.trigger_level_up(user_id, group_id);
        }
        catch (error)
        {
            await client.query("ROLLBACK");
            throw error;
        }
        finally
        {
            client.release();
        }
    }


    async create_private_chat(user_id: privateChatData["user_id"])
    {
        const result = await this.pool.query(
            `
            INSERT INTO private_chats (user_id)
            VALUES ($1) returning *`,
            [user_id]
        );
        return result.rows[0];
    }


    async get_private_chat(user_id: privateChatData["user_id"]): Promise<privateChatData>
    {
        const result = await this.pool.query(
            `
            SELECT * FROM private_chats
            WHERE user_id = $1`,
            [user_id]
        );
        return result.rows[0];
    }


    async get_all_private_chats(): Promise<privateChatData[]>
    {
        const result = await this.pool.query(
            `
            SELECT * FROM private_chats`
        );
        return result.rows;
    }


    async schedule_notification(message: notificationData["message"], scheduled_at: notificationData["scheduled_at"])
    {
        await this.pool.query(
            `
            INSERT INTO notifications (message, scheduled_at)
            VALUES ($1, $2)`,
            [message, scheduled_at]
        );
    }


    async get_sendable_notifications(): Promise<notificationData[]>
    {
        const now = Date.now();
        const result = await this.pool.query(
            `
            SELECT * FROM notifications
            WHERE scheduled_at <= $1 AND expired = $2`,
            [now, false]
        );
        return result.rows;
    }


    async expire_notification(notification_id: notificationData["id"])
    {
        await this.pool.query(
            `
            UPDATE notifications
            SET expired = $2
            WHERE id = $1`,
            [notification_id, true]
        );
    }
}



export default Database;