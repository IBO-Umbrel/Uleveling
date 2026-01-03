import express from "express";

const app = express();
app.use(express.json({verify: (req, res, buf) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).rawBody = buf;
}}));

export { app };
