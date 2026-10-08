import express from "express";
import cors from "cors";
import assignmentsRouter from "./routes/assignments.js";
import gradeRouter from "./routes/grade.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/api/assignments", assignmentsRouter);
app.use("/api/grade", gradeRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Assignment grader API listening on http://localhost:${port}`);
});
