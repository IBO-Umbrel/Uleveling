/// <reference types="node" />



interface groupData
{
    id: number;
    total_messages: number;
    random_reward?: number;
}
interface userData
{
    id: number;
    group_id: groupData["id"];
    level: number;
    experience: number;
    total_messages: number;
    last_message_timestamp: number;
}
interface activeUsersData
{
    user_id: userData["id"];
    group_id: groupData["id"];
    last_active_timestamp: number;
}