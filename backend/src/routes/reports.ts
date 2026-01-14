import { Elysia } from "elysia";
import * as XLSX from "xlsx";
import { query } from "../db";

function ensureTeacher(auth: any) {
  return auth && (auth.role === "teacher" || auth.role === "admin");
}

function escapeCsv(value: any) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/\"/g, "\"\"")}"`;
  }
  return text;
}

export const reportsRoutes = new Elysia({ prefix: "/reports" })
  .get("/exams/:id/scores", async ({ auth, params, query: qs, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }

    const format = String((qs as any).format || "csv");
    const examId = (params as any).id;
    const rows = await query<any>(
      "SELECT u.email, s.status, s.start_time, s.end_time, g.total_score, g.grade_letter FROM exam_sessions s JOIN users u ON u.id = s.user_id LEFT JOIN grades g ON g.session_id = s.id WHERE s.exam_id = ? ORDER BY s.start_time DESC",
      [examId]
    );

    const normalized = rows.map((row: any) => ({
      Email: row.email,
      Status: row.status,
      StartTime: row.start_time ? new Date(row.start_time).toISOString() : "",
      EndTime: row.end_time ? new Date(row.end_time).toISOString() : "",
      TotalScore: row.total_score ?? "",
      Grade: row.grade_letter ?? ""
    }));

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(normalized);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Scores");
      const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"exam-${examId}-scores.xlsx\"`
        }
      });
    }

    const header = ["Email", "Status", "StartTime", "EndTime", "TotalScore", "Grade"];
    const lines = [header.join(",")].concat(
      normalized.map((row) => header.map((key) => escapeCsv((row as any)[key])).join(","))
    );
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"exam-${examId}-scores.csv\"`
      }
    });
  })
  .get("/sessions/:id/report", async ({ auth, params, query: qs, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }

    const sessionId = (params as any).id;
    const format = String((qs as any).format || "json");
    const session = await query<any>(
      "SELECT s.id, s.exam_id, s.start_time, s.end_time, u.email, e.title, g.total_score, g.grade_letter FROM exam_sessions s JOIN exams e ON e.id = s.exam_id JOIN users u ON u.id = s.user_id LEFT JOIN grades g ON g.session_id = s.id WHERE s.id = ?",
      [sessionId]
    );
    if (!session.length) {
      set.status = 404;
      return { error: "Session not found" };
    }
    const info = session[0];

    const totalWeightRow = await query<any>(
      "SELECT SUM(weight) as total_weight FROM exam_questions WHERE exam_id = ?",
      [info.exam_id]
    );
    const totalWeight = Number(totalWeightRow[0]?.total_weight || 0);

    const questions = await query<any>(
      "SELECT q.id, q.content, q.type, eq.weight, a.response, a.score FROM exam_questions eq JOIN questions q ON q.id = eq.question_id LEFT JOIN answers a ON a.question_id = q.id AND a.session_id = ? WHERE eq.exam_id = ? ORDER BY eq.position ASC",
      [sessionId, info.exam_id]
    );

    const mapped = questions.map((row: any) => ({
      id: row.id,
      content: row.content,
      type: row.type,
      weight: Number(row.weight || 0),
      score: row.score !== null ? Number(row.score) : null,
      response: row.response ? JSON.parse(row.response) : null
    }));

    const payload = {
      sessionId,
      examId: info.exam_id,
      examTitle: info.title,
      studentEmail: info.email,
      startTime: info.start_time,
      endTime: info.end_time,
      totalScore: info.total_score ?? null,
      gradeLetter: info.grade_letter ?? null,
      totalWeight,
      questions: mapped
    };

    if (format === "csv") {
      const header = [
        "QuestionId",
        "Type",
        "Weight",
        "Score",
        "Response",
        "Content"
      ];
      const lines = [header.join(",")].concat(
        mapped.map((row) =>
          header
            .map((key) => {
              const value =
                key === "QuestionId"
                  ? row.id
                  : key === "Weight"
                  ? row.weight
                  : key === "Score"
                  ? row.score
                  : key === "Response"
                  ? row.response === null
                    ? ""
                    : typeof row.response === "string"
                    ? row.response
                    : JSON.stringify(row.response)
                  : key === "Content"
                  ? row.content
                  : (row as any)[key.toLowerCase()];
              return escapeCsv(value ?? "");
            })
            .join(",")
        )
      );
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"session-${sessionId}-report.csv\"`
        }
      });
    }

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet([
        {
          ExamTitle: payload.examTitle,
          StudentEmail: payload.studentEmail,
          StartTime: payload.startTime,
          EndTime: payload.endTime,
          TotalScore: payload.totalScore ?? "",
          Grade: payload.gradeLetter ?? "",
          TotalWeight: payload.totalWeight
        }
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
      const questionsSheet = XLSX.utils.json_to_sheet(
        mapped.map((row) => ({
          QuestionId: row.id,
          Type: row.type,
          Weight: row.weight,
          Score: row.score ?? "",
          Response:
            row.response === null
              ? ""
              : typeof row.response === "string"
              ? row.response
              : JSON.stringify(row.response),
          Content: row.content
        }))
      );
      XLSX.utils.book_append_sheet(workbook, questionsSheet, "Questions");
      const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"session-${sessionId}-report.xlsx\"`
        }
      });
    }

    return payload;
  })
  .get("/exams/:id/analytics", async ({ auth, params, query: qs, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }

    const examId = (params as any).id;
    const format = String((qs as any).format || "json");
    const totalWeightRow = await query<any>(
      "SELECT SUM(weight) as total_weight FROM exam_questions WHERE exam_id = ?",
      [examId]
    );
    const totalWeight = Number(totalWeightRow[0]?.total_weight || 0);

    const questionRows = await query<any>(
      "SELECT q.id, q.content, q.type, eq.weight, COUNT(a.response) as attempts, SUM(CASE WHEN a.score >= eq.weight THEN 1 ELSE 0 END) as correct_count, AVG(a.score) as average_score FROM exam_questions eq JOIN questions q ON q.id = eq.question_id LEFT JOIN exam_sessions s ON s.exam_id = eq.exam_id LEFT JOIN answers a ON a.session_id = s.id AND a.question_id = q.id WHERE eq.exam_id = ? GROUP BY q.id, q.content, q.type, eq.weight ORDER BY eq.position ASC",
      [examId]
    );

    const questions = questionRows.map((row: any) => {
      const attempts = Number(row.attempts || 0);
      const correct = Number(row.correct_count || 0);
      return {
        id: row.id,
        content: row.content,
        type: row.type,
        weight: Number(row.weight || 0),
        attempts,
        correct,
        difficulty: attempts > 0 ? correct / attempts : null,
        averageScore: row.average_score !== null ? Number(row.average_score) : null
      };
    });

    const sessions = await query<any>(
      "SELECT g.total_score as total_score FROM exam_sessions s LEFT JOIN grades g ON g.session_id = s.id WHERE s.exam_id = ? AND g.total_score IS NOT NULL",
      [examId]
    );
    const totalSessionsRow = await query<any>(
      "SELECT COUNT(*) as total_sessions FROM exam_sessions WHERE exam_id = ?",
      [examId]
    );
    const totalSessions = Number(totalSessionsRow[0]?.total_sessions || 0);

    const buckets = [
      { label: "0-39", min: 0, max: 39 },
      { label: "40-54", min: 40, max: 54 },
      { label: "55-69", min: 55, max: 69 },
      { label: "70-84", min: 70, max: 84 },
      { label: "85-100", min: 85, max: 100 }
    ];

    const distribution = buckets.map((bucket) => ({ ...bucket, count: 0 }));

    for (const session of sessions) {
      const score = Number(session.total_score || 0);
      const percent = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
      const bucket = distribution.find((item) => percent >= item.min && percent <= item.max);
      if (bucket) bucket.count += 1;
    }

    const payload = {
      totalWeight,
      totalSessions,
      distribution: distribution.map(({ label, count }) => ({ label, count })),
      questions
    };

    if (format === "csv") {
      const header = [
        "QuestionId",
        "Type",
        "Attempts",
        "Correct",
        "DifficultyPercent",
        "AverageScore"
      ];
      const lines = [header.join(",")].concat(
        payload.questions.map((row) =>
          header
            .map((key) => {
              const value = (row as any)[
                key === "QuestionId"
                  ? "id"
                  : key === "DifficultyPercent"
                  ? "difficulty"
                  : key === "AverageScore"
                  ? "averageScore"
                  : key.charAt(0).toLowerCase() + key.slice(1)
              ];
              if (key === "DifficultyPercent") {
                return escapeCsv(
                  value === null ? "" : Math.round(Number(value) * 100).toString()
                );
              }
              return escapeCsv(value ?? "");
            })
            .join(",")
        )
      );
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"exam-${examId}-analytics.csv\"`
        }
      });
    }

    return payload;
  });
