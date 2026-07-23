import assert from "node:assert/strict";
import test from "node:test";

import {
  TRIAL_ANTI_ABUSE_REASON,
  TRIAL_DEFAULT_IP_DAILY_GRANT_LIMIT,
  TRIAL_DEVICE_COOKIE_MAX_AGE_SECONDS,
  TRIAL_DEVICE_COOKIE_NAME,
  TRIAL_PHONE_MAX_DIGITS,
  TRIAL_PHONE_MIN_DIGITS,
  buildTrialE164Digits,
  canonicalizeTrialEmail,
  canonicalizeTrialPhone,
  isTrialAntiAbuseReason,
  isValidTrialEmail,
  isValidTrialPhoneDigits,
  normalizeTrialEmail,
  normalizeTrialPhoneDigits,
  trialAntiAbuseAdminMessage,
  trialAntiAbusePublicMessage,
} from "../src/lib/trialAntiAbuse.ts";

test("normaliza caixa, espacos externos e caracteres de compatibilidade no e-mail", () => {
  assert.equal(normalizeTrialEmail("  ＵＳＥＲ＠ＥＸＡＭＰＬＥ．ＣＯＭ  "), "user@example.com");
});

test("canonicaliza pontos, plus-tag e Googlemail apenas para Gmail", () => {
  assert.equal(canonicalizeTrialEmail(" Foo.Bar+bônus@GMAIL.com "), "foobar@gmail.com");
  assert.equal(canonicalizeTrialEmail("f.o.o+tag@googlemail.com"), "foo@gmail.com");
  assert.equal(canonicalizeTrialEmail("Foo.Bar+tag@outlook.com"), "foo.bar+tag@outlook.com");
});

test("nao canonicaliza como Gmail dominios parecidos ou enderecos estruturalmente invalidos", () => {
  assert.equal(
    canonicalizeTrialEmail("foo.bar+tag@gmail.com.example"),
    "foo.bar+tag@gmail.com.example",
  );
  assert.equal(canonicalizeTrialEmail("foo@bar@gmail.com"), "foo@bar@gmail.com");
});

test("valida o formato basico do e-mail usado no cadastro", () => {
  assert.equal(isValidTrialEmail("user@example.com"), true);
  assert.equal(isValidTrialEmail("first.last+tag@example.com"), true);
  assert.equal(isValidTrialEmail("a..b@example.com"), false);
  assert.equal(isValidTrialEmail("user @example.com"), false);
  assert.equal(isValidTrialEmail("@gmail.com"), false);
  assert.equal(isValidTrialEmail("user@-example.com"), false);
});

test("normaliza telefone internacional para digitos e remove prefixo 00", () => {
  assert.equal(normalizeTrialPhoneDigits("+55 (11) 99999-0000"), "5511999990000");
  assert.equal(normalizeTrialPhoneDigits("00 351 912 345 678"), "351912345678");
  assert.equal(normalizeTrialPhoneDigits("＋５５ １１ ９９９９９－００００"), "5511999990000");
});

test("combina DDI e numero nacional sem duplicar numero explicitamente internacional", () => {
  assert.equal(buildTrialE164Digits("+55", "11 99999-0000"), "5511999990000");
  assert.equal(buildTrialE164Digits("55", "+351 912 345 678"), "351912345678");
  assert.equal(buildTrialE164Digits("+1234", "99999999"), "");
});

test("valida o intervalo E.164-ish de 8 a 15 digitos e primeiro digito nao zero", () => {
  assert.equal(TRIAL_PHONE_MIN_DIGITS, 8);
  assert.equal(TRIAL_PHONE_MAX_DIGITS, 15);
  assert.equal(isValidTrialPhoneDigits("12345678"), true);
  assert.equal(isValidTrialPhoneDigits("123456789012345"), true);
  assert.equal(isValidTrialPhoneDigits("1234567"), false);
  assert.equal(isValidTrialPhoneDigits("1234567890123456"), false);
  assert.equal(isValidTrialPhoneDigits("0123456789"), false);
  assert.equal(canonicalizeTrialPhone("1234567"), "");
});

test("expoe constantes e mensagens sem revelar o sinal antifraude ao cliente", () => {
  assert.equal(TRIAL_DEVICE_COOKIE_NAME, "sb_trial_device");
  assert.equal(TRIAL_DEVICE_COOKIE_MAX_AGE_SECONDS, 34_560_000);
  assert.equal(TRIAL_DEFAULT_IP_DAILY_GRANT_LIMIT, 3);
  assert.equal(isTrialAntiAbuseReason(TRIAL_ANTI_ABUSE_REASON.deviceAlreadyClaimed), true);
  assert.equal(isTrialAntiAbuseReason("unknown_reason"), false);
  assert.match(
    trialAntiAbuseAdminMessage(TRIAL_ANTI_ABUSE_REASON.deviceAlreadyClaimed),
    /dispositivo/i,
  );
  assert.equal(
    trialAntiAbusePublicMessage(TRIAL_ANTI_ABUSE_REASON.deviceAlreadyClaimed),
    trialAntiAbusePublicMessage(TRIAL_ANTI_ABUSE_REASON.emailAlreadyClaimed),
  );
});
