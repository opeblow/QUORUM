import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Toaster } from "sonner"
import { I18nProvider } from "@/lib/i18n"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin", "latin-ext"], weight: "400", style: ["normal", "italic"] })

export const metadata: Metadata = {
	title: { default: "Quorum — a team of AI agents in every meeting", template: "%s · Quorum" },
	description:
		"Quorum puts a team of concurrent AI agents in your meeting: they fact-check claims live, track decisions, capture action items and challenge groupthink — while you talk.",
}

export const viewport: Viewport = { themeColor: "#f7f6f2", colorScheme: "light" }

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}>
			<body className="flex min-h-full flex-col bg-bg text-text">
				<I18nProvider>{children}</I18nProvider>
				<Toaster theme="light" position="bottom-right" closeButton toastOptions={{ className: "" }} />
			</body>
		</html>
	)
}
