import { describe, expect, test } from "vitest";
import { fitReply, mentionedAddresses, mentionsKageon } from "./rules";
describe("Kageon mention rules", () => {
  test("replies to exact case-insensitive username mentions", () => {
    expect(mentionsKageon("@KAGEON explain this")).toBe(true);
    expect(mentionsKageon("hello @kageon!")).toBe(true);
    expect(mentionsKageon("@kageon_fake explain")).toBe(false);
    expect(mentionsKageon("email@kageon")).toBe(false);
  });
  test("fits existing 300-character reply constraint", () => {
    expect(fitReply("x".repeat(350)).length).toBe(300);
    expect(fitReply(" Hello ")).toBe("Hello");
  });
  test("uses only explicit blockchain addresses", () => {
    expect(mentionedAddresses("$MIND token")).toEqual([]);
    expect(mentionedAddresses("0x7d249d242a02e19a10b367a2fa9407cb03bee1ac")).toEqual(["0x7d249d242a02e19a10b367a2fa9407cb03bee1ac"]);
  });
});