/**
 * Speech-recognition languages, African languages and accents first. Codes are BCP-47 tags the
 * browser's recogniser understands (Chrome/Edge); accent-specific English improves accuracy a lot.
 */
export const SPEECH_LANGUAGES = [
	{ code: "en-NG", label: "English (Nigeria)" },
	{ code: "en-KE", label: "English (Kenya)" },
	{ code: "en-ZA", label: "English (South Africa)" },
	{ code: "en-GH", label: "English (Ghana)" },
	{ code: "en-TZ", label: "English (Tanzania)" },
	{ code: "sw-KE", label: "Kiswahili (Kenya)" },
	{ code: "sw-TZ", label: "Kiswahili (Tanzania)" },
	{ code: "zu-ZA", label: "isiZulu" },
	{ code: "af-ZA", label: "Afrikaans" },
	{ code: "am-ET", label: "Amharic" },
	{ code: "ar-EG", label: "Arabic (Egypt)" },
	{ code: "ar-MA", label: "Arabic (Morocco)" },
	{ code: "fr-SN", label: "Français (Sénégal)" },
	{ code: "fr-CI", label: "Français (Côte d’Ivoire)" },
	{ code: "fr-FR", label: "Français" },
	{ code: "pt-PT", label: "Português" },
	{ code: "en-GB", label: "English (UK)" },
	{ code: "en-US", label: "English (US)" },
] as const

export const LANGUAGE_KEY = "quorum.speechLang"

export function defaultSpeechLanguage(): string {
	if (typeof window === "undefined") return "en-NG"
	try {
		const saved = window.localStorage.getItem(LANGUAGE_KEY)
		if (saved) return saved
	} catch {
		/* storage unavailable */
	}
	const browser = navigator.language
	return SPEECH_LANGUAGES.some((l) => l.code === browser) ? browser : "en-NG"
}
