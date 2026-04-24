import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, Inter, Space_Mono } from "next/font/google";
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Document Reviewer — Reframe Concepts",
  description: "Client document intake and review platform",
};

async function getImpersonationState() {
  try {
    const cookieStore = await cookies()
    const impersonateId = cookieStore.get('rc_impersonate')?.value
    if (!impersonateId) return null

    const admin = createAdminClient()
    const { data: { user }, error } = await admin.auth.admin.getUserById(impersonateId)
    if (error || !user) return null

    const { data: roleData } = await admin
      .from('user_roles').select('role').eq('user_id', impersonateId).single()
    const { data: profile } = await admin
      .from('user_profiles').select('first_name, last_name').eq('user_id', impersonateId).single()

    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null

    return { email: user.email ?? impersonateId, role: roleData?.role ?? null, name }
  } catch {
    return null
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const impersonation = await getImpersonationState()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {impersonation && (
          <ImpersonationBanner email={impersonation.email} role={impersonation.role} name={impersonation.name} />
        )}
        {children}
      </body>
    </html>
  );
}
