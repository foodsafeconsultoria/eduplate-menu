import { describe, it, expect } from "vitest";
import {
  editorDraftKey,
  pushEditorHistory,
  readEditorDraft,
} from "./menuEditorRecovery";

describe("proteção do editor", () => {
  it("isola rascunhos por organização e usuário, inclusive delimitadores", () => {
    expect(editorDraftKey("a:b", "c")).not.toBe(editorDraftKey("a", "b:c"));
    expect(editorDraftKey("a", "u")).not.toBe(editorDraftKey("b", "u"));
    expect(editorDraftKey("a", "u")).not.toBe(editorDraftKey("a", "v"));
  });
  it("recupera composição e baseline sem aceitar cache corrompido", () => {
    const value = {
      version: 1,
      snapshot: { slots: [{ mealCount: 0 }], title: "Semana" },
      baseline: "{}",
      savedAt: "2026-10-22T12:00:00Z",
    };
    expect(
      readEditorDraft({ getItem: () => JSON.stringify(value) }, "k")
    ).toEqual(value);
    for (const raw of [
      "{",
      "null",
      "{}",
      JSON.stringify({ ...value, version: 9 }),
      JSON.stringify({ ...value, savedAt: "invalid" }),
    ])
      expect(readEditorDraft({ getItem: () => raw }, "k")).toBeNull();
  });
  it("descarta o futuro após desfazer e iniciar uma nova edição", () => {
    expect(pushEditorHistory(["a", "b", "c"], 1, "d")).toEqual({
      history: ["a", "b", "d"],
      cursor: 2,
    });
    expect(pushEditorHistory(["a", "b"], 1, "b").history).toEqual(["a", "b"]);
  });
  it("limita memória sem perder o estado mais recente", () => {
    const result = pushEditorHistory(
      Array.from({ length: 50 }, (_, i) => String(i)),
      49,
      "novo"
    );
    expect(result.history).toHaveLength(50);
    expect(result.history[49]).toBe("novo");
    expect(result.cursor).toBe(49);
  });
});
