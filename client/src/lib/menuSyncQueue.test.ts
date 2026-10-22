import { describe, expect, it } from "vitest";
import { acknowledgeMenu, readPendingMenus } from "./menuSyncQueue";
describe("confirmação de salvamento de cardápios", () => {
  it("mantém edição nova se a confirmação antiga chegar depois", () => {
    const sent = { id: "m", title: "antigo" };
    const latest = { ...sent, title: "novo" };
    expect(acknowledgeMenu({ m: latest }, sent)).toEqual({ m: latest });
    expect(acknowledgeMenu({ m: latest }, latest)).toEqual({});
  });
  it("não remove outros registros ao confirmar um cardápio", () => {
    const menu = { id: "m" };
    expect(acknowledgeMenu({ m: menu, other: { id: "other" } }, menu)).toEqual({
      other: { id: "other" },
    });
  });
  it("não apaga silenciosamente filas corrompidas", () => {
    expect(readPendingMenus({ getItem: () => null }, "k")).toEqual({});
    expect(() => readPendingMenus({ getItem: () => "{" }, "k")).toThrow();
    expect(() => readPendingMenus({ getItem: () => "[]" }, "k")).toThrow();
  });
});
