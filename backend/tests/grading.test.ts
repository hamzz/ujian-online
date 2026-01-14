import { describe, expect, it } from "bun:test";
import { gradeAnswer } from "../src/grading";

describe("gradeAnswer", () => {
  it("scores multiple choice", () => {
    const score = gradeAnswer("multiple_choice", { correct: "B" }, "B");
    expect(score).toBe(1);
  });

  it("scores multiple select with exact match", () => {
    const score = gradeAnswer("multiple_select", { correct: ["A", "C"] }, ["A", "C"]);
    expect(score).toBe(1);
  });

  it("rejects multiple select when missing option", () => {
    const score = gradeAnswer("multiple_select", { correct: ["A", "C"] }, ["A"]);
    expect(score).toBe(0);
  });

  it("scores true false", () => {
    const score = gradeAnswer("true_false", { correct: true }, true);
    expect(score).toBe(1);
  });

  it("scores short answer exact", () => {
    const score = gradeAnswer("short_answer", { correct: "Newton" }, "newton");
    expect(score).toBe(1);
  });

  it("scores short answer keywords", () => {
    const score = gradeAnswer(
      "short_answer",
      { mode: "keywords", keywords: ["luas", "sisi"] },
      "luas persegi = sisi x sisi"
    );
    expect(score).toBe(1);
  });
});
