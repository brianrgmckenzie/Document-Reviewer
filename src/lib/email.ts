import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = 'Reframe Concierge <admin@reframeconcepts.com>'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------
function layout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0d0f14;border-radius:12px 12px 0 0;padding:24px 32px;">
          <span style="color:#f0f2f8;font-size:15px;font-weight:600;letter-spacing:-0.3px;">Reframe Concepts</span>
          <span style="color:#545d78;font-size:13px;margin-left:10px;">Document Review</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Reframe Concepts · Kelowna, BC · <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">review.reframeconcepts.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:8px;margin-top:24px;">${label}</a>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${text}</h1>`
}

function p(text: string, muted = false): string {
  return `<p style="margin:8px 0;font-size:14px;line-height:1.6;color:${muted ? '#6b7280' : '#374151'};">${text}</p>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">`
}

function pill(text: string, color: string): string {
  const map: Record<string, { bg: string; fg: string }> = {
    amber:  { bg: '#fef3c7', fg: '#92400e' },
    blue:   { bg: '#dbeafe', fg: '#1e40af' },
    green:  { bg: '#d1fae5', fg: '#065f46' },
  }
  const { bg, fg } = map[color] ?? map.blue
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;">${text}</span>`
}

// ---------------------------------------------------------------------------
// Welcome — Client
// ---------------------------------------------------------------------------
export async function sendWelcomeClient({
  to,
  tempPassword,
  projectName,
}: {
  to: string
  tempPassword: string
  projectName?: string
}) {
  const subject = projectName
    ? `Your document review workspace is ready — ${projectName}`
    : 'Your document review workspace is ready'

  await getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: layout(`
      ${h1('Your workspace is ready.')}
      ${p(projectName
        ? `Reframe Concepts has set up a secure document review portal for <strong>${projectName}</strong>. You can upload documents, track your project status, and communicate with our team — all in one place.`
        : 'Reframe Concepts has set up a secure document review portal for your project.'
      )}
      ${divider()}
      ${p('<strong>Login details</strong>')}
      ${p(`Email: <strong>${to}</strong>`)}
      ${p(`Temporary password: <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${tempPassword}</strong>`)}
      ${p('You can change your password after logging in.', true)}
      ${btn(`${APP_URL}/login`, 'Open your portal')}
    `),
  })
}

// ---------------------------------------------------------------------------
// Welcome — Staff
// ---------------------------------------------------------------------------
export async function sendWelcomeStaff({
  to,
  role,
  tempPassword,
}: {
  to: string
  role: string
  tempPassword: string
}) {
  const roleLabel = role === 'super_admin' ? 'Super Admin' : 'Project Admin'

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Your Reframe Concepts account is ready',
    html: layout(`
      ${h1('Welcome to the team.')}
      ${p(`Your Reframe Concepts document review account has been created with <strong>${roleLabel}</strong> access.`)}
      ${divider()}
      ${p('<strong>Login details</strong>')}
      ${p(`Email: <strong>${to}</strong>`)}
      ${p(`Temporary password: <strong style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${tempPassword}</strong>`)}
      ${p('You can change your password after logging in.', true)}
      ${btn(`${APP_URL}/login`, 'Sign in')}
    `),
  })
}

// ---------------------------------------------------------------------------
// Status change — notify clients
// ---------------------------------------------------------------------------
const STATUS_COPY: Record<string, { label: string; color: string; body: string }> = {
  under_review: {
    label: 'Under Review',
    color: 'blue',
    body: 'Our team has received your documents and has begun the review process. We\'ll be in touch if we need anything further.',
  },
  complete: {
    label: 'Complete',
    color: 'green',
    body: 'Your document review is complete. You can now log in to view your manuscript — a full synthesis of your project documents prepared by our team.',
  },
}

export async function sendStatusChange({
  to,
  projectName,
  projectSlug,
  status,
}: {
  to: string[]
  projectName: string
  projectSlug: string
  status: string
}) {
  const copy = STATUS_COPY[status]
  if (!copy || to.length === 0) return

  const projectUrl = `${APP_URL}/projects/${projectSlug}`

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${projectName} — ${copy.label}`,
    html: layout(`
      ${h1(projectName)}
      <p style="margin:8px 0 16px;">${pill(copy.label, copy.color)}</p>
      ${p(copy.body)}
      ${status === 'complete' ? btn(`${projectUrl}/manuscript`, 'View manuscript') : btn(projectUrl, 'View project')}
    `),
  })
}

// ---------------------------------------------------------------------------
// Upload notification — notify staff
// ---------------------------------------------------------------------------
export async function sendUploadNotification({
  to,
  uploaderEmail,
  fileName,
  projectName,
  projectSlug,
}: {
  to: string[]
  uploaderEmail: string
  fileName: string
  projectName: string
  projectSlug: string
}) {
  if (to.length === 0) return

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `New document uploaded — ${projectName}`,
    html: layout(`
      ${h1('New document uploaded')}
      ${p(`<strong>${uploaderEmail}</strong> uploaded a document to <strong>${projectName}</strong>.`)}
      ${divider()}
      ${p(`File: <strong>${fileName}</strong>`)}
      ${btn(`${APP_URL}/projects/${projectSlug}`, 'View project')}
    `),
  })
}

// ---------------------------------------------------------------------------
// Comment notification
// ---------------------------------------------------------------------------
export async function sendCommentNotification({
  to,
  commenterEmail,
  commentBody,
  documentTitle,
  projectName,
  projectSlug,
  documentId,
}: {
  to: string[]
  commenterEmail: string
  commentBody: string
  documentTitle: string
  projectName: string
  projectSlug: string
  documentId: string
}) {
  if (to.length === 0) return

  const truncated = commentBody.length > 200 ? commentBody.slice(0, 197) + '…' : commentBody

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `New comment on ${documentTitle} — ${projectName}`,
    html: layout(`
      ${h1('New comment')}
      ${p(`<strong>${commenterEmail}</strong> commented on <strong>${documentTitle}</strong> in ${projectName}.`)}
      ${divider()}
      <blockquote style="margin:0;padding:12px 16px;background:#f9fafb;border-left:3px solid #e5e7eb;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${truncated.replace(/\n/g, '<br>')}</p>
      </blockquote>
      ${btn(`${APP_URL}/projects/${projectSlug}/documents/${documentId}`, 'View document')}
    `),
  })
}
