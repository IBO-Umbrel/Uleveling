// import Database from "./Database";


// const db = new Database();


async function schedule_notification()
{
    // Example usage: schedule a notification now
    const message = "This is a scheduled notification.";
    const scheduled_at = Date.now();
    // await db.schedule_notification(message, scheduled_at);
    console.log("Notification scheduled.");
    console.log("Message:", message);
    console.log("Scheduled at:", scheduled_at);
}


schedule_notification().catch(console.error);