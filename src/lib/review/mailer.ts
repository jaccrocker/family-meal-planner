import "server-only";
import nodemailer from "nodemailer";
import { database } from "@/lib/store";
import type { Email } from "./email";

/**
 * Sends email through the transport named by EMAIL_TRANSPORT:
 * - log (default): records the message in the outbox table and the server log; nothing leaves the server
 * - smtp: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for example a Gmail app password)
 * - resend: RESEND_API_KEY, with EMAIL_FROM on a domain verified in Resend
 * EMAIL_ALLOWLIST (comma separated) limits real sends to those addresses while testing.
 */
export type Transport = "log" | "smtp" | "resend";

export function transport(): Transport {
  const t = process.env.EMAIL_TRANSPORT;
  return t === "smtp" || t === "resend" ? t : "log";
}

function allowed(to: string): boolean {
  const list = (process.env.EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(to.toLowerCase());
}

let smtp: nodemailer.Transporter | undefined;

async function deliver(t: Transport, to: string, mail: Email): Promise<void> {
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "Family Meal Planner <noreply@localhost>";
  if (t === "smtp") {
    smtp ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await smtp.sendMail({ from, to, subject: mail.subject, text: mail.text, html: mail.html });
    return;
  }
  if (t === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
  }
}

/** Records every message in the outbox, then sends it unless the transport is log or the address is not allowed. */
export async function sendMail(to: string, mail: Email): Promise<void> {
  const t = allowed(to) ? transport() : "log";
  const d = database();
  const { lastInsertRowid } = d
    .prepare(
      "insert into outbox (to_email, subject, body_text, body_html, transport, created_at) values (?, ?, ?, ?, ?, ?)",
    )
    .run(to, mail.subject, mail.text, mail.html, t, new Date().toISOString());
  if (t === "log") {
    console.log(`email (log only): ${mail.subject}`);
    return;
  }
  try {
    await deliver(t, to, mail);
    d.prepare("update outbox set sent_at = ? where id = ?").run(new Date().toISOString(), lastInsertRowid);
  } catch (e) {
    const msg = (e as Error).message;
    d.prepare("update outbox set error = ? where id = ?").run(msg, lastInsertRowid);
    console.error(`email failed: ${msg}`);
  }
}
