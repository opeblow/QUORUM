"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { LANGUAGE_KEY, defaultSpeechLanguage } from "./languages"

/**
 * Interface language follows the language a person picks for speech: choosing Kiswahili makes
 * both the recogniser and the whole room UI Kiswahili. English is the source of truth; other
 * locales fall back to English for any missing key.
 */
const en = {
	"status.connecting": "Connecting",
	"status.live": "Live",
	"status.reconnecting": "Reconnecting",
	"status.offline": "Offline",
	"status.closed": "Closed",
	"room.tokens": "tokens",
	"room.catchUp": "Catch me up",
	"room.invite": "Invite",
	"room.end": "End",
	"room.confirmEnd": "Confirm end",
	"room.tab.call": "Call",
	"room.tab.transcript": "Transcript",
	"room.tab.cards": "Cards",
	"room.agentWork": "Agent work",
	"room.chat": "Chat",
	"room.summarySoFar": "Summary so far",
	"room.everyoneCanTalk": "Everyone here can talk face to face — the agents listen in.",
	"room.joinWithCamera": "Join call with camera",
	"room.joinCall": "Join call",
	"room.peopleOnCamera": "People are talking on camera.",
	"room.notConnected": "Not connected — reconnecting…",
	"room.ended": "The meeting has ended",
	"room.openingRecap": "Opening the recap…",
	"room.notInRoom": "You’re not in this room.",
	"room.connectionClosed": "The connection was closed.",
	"room.tryAgain": "Try again",
	"room.dashboard": "Dashboard",
	"transcript.title": "Transcript",
	"transcript.empty": "Turn on your mic or type below. Everyone in the room sees the transcript live.",
	"transcript.listening": "Listening… or type here",
	"transcript.say": "Say something to the room…",
	"transcript.micOn": "Turn microphone on",
	"transcript.micOff": "Turn microphone off",
	"transcript.send": "Send",
	"transcript.you": "You",
	"transcript.language": "Language",
	"call.mute": "Mute microphone",
	"call.unmute": "Unmute microphone",
	"call.cameraOff": "Turn camera off",
	"call.cameraOn": "Turn camera on",
	"call.share": "Share screen",
	"call.stopShare": "Stop presenting",
	"call.saverOn": "Data saver on (360p)",
	"call.saverOff": "Data saver off",
	"call.leave": "Leave",
	"call.presenting": "{name} is presenting",
	"call.you": "you",
	"chat.empty": "Messages and files shared here stay with the meeting’s recap.",
	"chat.placeholder": "Message everyone…",
	"chat.attach": "Attach a file",
	"chat.send": "Send message",
	"chat.tooBig": "Files can be up to 10 MB",
	"invite.title": "Invite people",
	"invite.desc": "Anyone with the link can join with just their name.",
	"invite.copy": "Copy",
	"invite.copied": "Copied",
	"invite.whatsapp": "WhatsApp",
	"invite.email": "Email",
	"invite.more": "More",
	"invite.message": "Join \"{title}\" on Quorum: {url}",
	"common.close": "Close",
	"catchup.title": "What you missed",
	"catchup.nothing": "Nothing yet — you’re right on time.",
	"catchup.decided": "Decided",
	"catchup.assigned": "Assigned",
	"feed.empty": "Fact-checks, decisions, action items and challenges appear here while the conversation moves.",
	"feed.searching": "searching…",
	"feed.correction": "Correction",
	"feed.decision": "Decision",
	"feed.approved": "Approved",
	"feed.declined": "Declined",
	"feed.rejected": "Rejected",
	"feed.by": "by",
	"feed.due": "Due",
	"feed.challenge": "Challenge",
	"verdict.checking": "Checking",
	"verdict.supported": "Supported",
	"verdict.disputed": "Disputed",
	"verdict.refuted": "False",
	"verdict.unverifiable": "Can't verify",
	"verdict.failed": "Check failed",
	"verdict.dismissed": "Not a claim",
	"recall.contradicts": "Contradicts an earlier decision",
	"recall.supports": "Consistent with before",
	"recall.context": "From an earlier meeting",
	"approval.needs": "Needs your approval",
	"approval.paused": "The Action Owner is paused until someone in the room decides.",
	"approval.approve": "Approve",
	"approval.reject": "Reject",
	"orbit.working": "{n} working",
	"orbit.listening": "listening",
	"orbit.topics": "Topics appear as you talk",
	"agent.scribe": "Scribe",
	"agent.fact_checker": "Fact-Checker",
	"agent.researcher": "Researcher",
	"agent.decision_tracker": "Decision Tracker",
	"agent.action_owner": "Action Owner",
	"agent.devils_advocate": "Devil's Advocate",
	"agent.memory_keeper": "Memory Keeper",
	"phase.listening": "Listening",
	"phase.queued": "Queued",
	"phase.thinking": "Thinking",
	"phase.tool": "Researching",
	"phase.answering": "Writing",
	"phase.paused": "Waiting for you",
	"phase.degraded": "Degraded",
} as const

export type MessageKey = keyof typeof en
type Dict = Partial<Record<MessageKey, string>>

const fr: Dict = {
	"status.connecting": "Connexion", "status.live": "En direct", "status.reconnecting": "Reconnexion", "status.offline": "Hors ligne", "status.closed": "Fermé",
	"room.tokens": "jetons", "room.catchUp": "Me mettre à jour", "room.invite": "Inviter", "room.end": "Terminer", "room.confirmEnd": "Confirmer la fin",
	"room.tab.call": "Appel", "room.tab.transcript": "Transcription", "room.tab.cards": "Fiches", "room.agentWork": "Travail des agents", "room.chat": "Discussion",
	"room.summarySoFar": "Résumé jusqu’ici", "room.everyoneCanTalk": "Tout le monde peut parler face à face — les agents écoutent.",
	"room.joinWithCamera": "Rejoindre avec la caméra", "room.joinCall": "Rejoindre l’appel", "room.peopleOnCamera": "Des personnes parlent en vidéo.",
	"room.notConnected": "Non connecté — reconnexion…", "room.ended": "La réunion est terminée", "room.openingRecap": "Ouverture du compte rendu…",
	"room.notInRoom": "Vous n’êtes pas dans cette salle.", "room.connectionClosed": "La connexion a été fermée.", "room.tryAgain": "Réessayer", "room.dashboard": "Tableau de bord",
	"transcript.title": "Transcription", "transcript.empty": "Activez votre micro ou écrivez ci-dessous. Tout le monde voit la transcription en direct.",
	"transcript.listening": "J’écoute… ou écrivez ici", "transcript.say": "Dites quelque chose à la salle…", "transcript.micOn": "Activer le micro", "transcript.micOff": "Couper le micro",
	"transcript.send": "Envoyer", "transcript.you": "Vous", "transcript.language": "Langue",
	"call.mute": "Couper le micro", "call.unmute": "Activer le micro", "call.cameraOff": "Couper la caméra", "call.cameraOn": "Activer la caméra",
	"call.share": "Partager l’écran", "call.stopShare": "Arrêter la présentation", "call.saverOn": "Économie de données activée (360p)", "call.saverOff": "Économie de données désactivée",
	"call.leave": "Quitter", "call.presenting": "{name} présente", "call.you": "vous",
	"chat.empty": "Les messages et fichiers partagés ici restent dans le compte rendu.", "chat.placeholder": "Écrire à tout le monde…", "chat.attach": "Joindre un fichier", "chat.send": "Envoyer le message", "chat.tooBig": "Les fichiers sont limités à 10 Mo",
	"invite.title": "Inviter des personnes", "invite.desc": "Toute personne ayant le lien peut rejoindre avec son seul nom.", "invite.copy": "Copier", "invite.copied": "Copié", "invite.email": "E-mail", "invite.more": "Plus",
	"invite.message": "Rejoignez « {title} » sur Quorum : {url}", "common.close": "Fermer",
	"catchup.title": "Ce que vous avez manqué", "catchup.nothing": "Rien pour l’instant — vous êtes à l’heure.", "catchup.decided": "Décidé", "catchup.assigned": "Attribué",
	"feed.empty": "Vérifications, décisions, actions et objections apparaissent ici au fil de la conversation.", "feed.searching": "recherche…", "feed.correction": "Correction",
	"feed.decision": "Décision", "feed.approved": "Approuvé", "feed.declined": "Refusé", "feed.rejected": "Refusé", "feed.by": "par", "feed.due": "Échéance", "feed.challenge": "Objection",
	"verdict.checking": "Vérification", "verdict.supported": "Confirmé", "verdict.disputed": "Contesté", "verdict.refuted": "Faux", "verdict.unverifiable": "Invérifiable", "verdict.failed": "Échec", "verdict.dismissed": "Pas une affirmation",
	"recall.contradicts": "Contredit une décision antérieure", "recall.supports": "Cohérent avec avant", "recall.context": "D’une réunion précédente",
	"approval.needs": "Votre approbation est requise", "approval.paused": "L’agent attend que quelqu’un décide.", "approval.approve": "Approuver", "approval.reject": "Refuser",
	"orbit.working": "{n} au travail", "orbit.listening": "à l’écoute", "orbit.topics": "Les sujets apparaissent pendant que vous parlez",
	"agent.scribe": "Scribe", "agent.fact_checker": "Vérificateur", "agent.researcher": "Chercheur", "agent.decision_tracker": "Suivi des décisions", "agent.action_owner": "Responsable des actions", "agent.devils_advocate": "Avocat du diable", "agent.memory_keeper": "Gardien de la mémoire",
	"phase.listening": "À l’écoute", "phase.queued": "En attente", "phase.thinking": "Réflexion", "phase.tool": "Recherche", "phase.answering": "Rédaction", "phase.paused": "Vous attend", "phase.degraded": "Dégradé",
}

const pt: Dict = {
	"status.connecting": "A ligar", "status.live": "Ao vivo", "status.reconnecting": "A religar", "status.offline": "Offline", "status.closed": "Fechado",
	"room.tokens": "tokens", "room.catchUp": "Pôr-me a par", "room.invite": "Convidar", "room.end": "Terminar", "room.confirmEnd": "Confirmar fim",
	"room.tab.call": "Chamada", "room.tab.transcript": "Transcrição", "room.tab.cards": "Cartões", "room.agentWork": "Trabalho dos agentes", "room.chat": "Conversa",
	"room.summarySoFar": "Resumo até agora", "room.everyoneCanTalk": "Todos podem falar cara a cara — os agentes estão a ouvir.",
	"room.joinWithCamera": "Entrar com câmara", "room.joinCall": "Entrar na chamada", "room.peopleOnCamera": "Há pessoas a falar em vídeo.",
	"room.notConnected": "Sem ligação — a religar…", "room.ended": "A reunião terminou", "room.openingRecap": "A abrir o resumo…",
	"room.notInRoom": "Não está nesta sala.", "room.connectionClosed": "A ligação foi fechada.", "room.tryAgain": "Tentar de novo", "room.dashboard": "Painel",
	"transcript.title": "Transcrição", "transcript.empty": "Ligue o microfone ou escreva abaixo. Todos veem a transcrição em direto.",
	"transcript.listening": "A ouvir… ou escreva aqui", "transcript.say": "Diga algo à sala…", "transcript.micOn": "Ligar microfone", "transcript.micOff": "Desligar microfone",
	"transcript.send": "Enviar", "transcript.you": "Você", "transcript.language": "Idioma",
	"call.mute": "Silenciar microfone", "call.unmute": "Ativar microfone", "call.cameraOff": "Desligar câmara", "call.cameraOn": "Ligar câmara",
	"call.share": "Partilhar ecrã", "call.stopShare": "Parar apresentação", "call.saverOn": "Poupança de dados ligada (360p)", "call.saverOff": "Poupança de dados desligada",
	"call.leave": "Sair", "call.presenting": "{name} está a apresentar", "call.you": "você",
	"chat.empty": "Mensagens e ficheiros partilhados aqui ficam no resumo da reunião.", "chat.placeholder": "Mensagem para todos…", "chat.attach": "Anexar ficheiro", "chat.send": "Enviar mensagem", "chat.tooBig": "Ficheiros até 10 MB",
	"invite.title": "Convidar pessoas", "invite.desc": "Quem tiver o link pode entrar só com o nome.", "invite.copy": "Copiar", "invite.copied": "Copiado", "invite.email": "Email", "invite.more": "Mais",
	"invite.message": "Entre em \"{title}\" no Quorum: {url}", "common.close": "Fechar",
	"catchup.title": "O que perdeu", "catchup.nothing": "Nada ainda — chegou a tempo.", "catchup.decided": "Decidido", "catchup.assigned": "Atribuído",
	"feed.empty": "Verificações, decisões, ações e objeções aparecem aqui durante a conversa.", "feed.searching": "a pesquisar…", "feed.correction": "Correção",
	"feed.decision": "Decisão", "feed.approved": "Aprovado", "feed.declined": "Recusado", "feed.rejected": "Rejeitado", "feed.by": "por", "feed.due": "Prazo", "feed.challenge": "Objeção",
	"verdict.checking": "A verificar", "verdict.supported": "Confirmado", "verdict.disputed": "Contestado", "verdict.refuted": "Falso", "verdict.unverifiable": "Não verificável", "verdict.failed": "Falhou", "verdict.dismissed": "Não é afirmação",
	"recall.contradicts": "Contradiz uma decisão anterior", "recall.supports": "Coerente com antes", "recall.context": "De uma reunião anterior",
	"approval.needs": "Precisa da sua aprovação", "approval.paused": "O agente está em pausa até alguém decidir.", "approval.approve": "Aprovar", "approval.reject": "Rejeitar",
	"orbit.working": "{n} a trabalhar", "orbit.listening": "a ouvir", "orbit.topics": "Os temas aparecem enquanto fala",
	"agent.scribe": "Escriba", "agent.fact_checker": "Verificador", "agent.researcher": "Pesquisador", "agent.decision_tracker": "Registo de decisões", "agent.action_owner": "Responsável de ações", "agent.devils_advocate": "Advogado do diabo", "agent.memory_keeper": "Guardião da memória",
	"phase.listening": "A ouvir", "phase.queued": "Na fila", "phase.thinking": "A pensar", "phase.tool": "A pesquisar", "phase.answering": "A escrever", "phase.paused": "À sua espera", "phase.degraded": "Degradado",
}

const sw: Dict = {
	"status.connecting": "Inaunganisha", "status.live": "Moja kwa moja", "status.reconnecting": "Inaunganisha upya", "status.offline": "Nje ya mtandao", "status.closed": "Imefungwa",
	"room.tokens": "tokeni", "room.catchUp": "Nieleze nilichokosa", "room.invite": "Alika", "room.end": "Maliza", "room.confirmEnd": "Thibitisha kumaliza",
	"room.tab.call": "Simu", "room.tab.transcript": "Nakala", "room.tab.cards": "Kadi", "room.agentWork": "Kazi ya mawakala", "room.chat": "Gumzo",
	"room.summarySoFar": "Muhtasari hadi sasa", "room.everyoneCanTalk": "Kila mtu anaweza kuzungumza ana kwa ana — mawakala wanasikiliza.",
	"room.joinWithCamera": "Jiunge kwa kamera", "room.joinCall": "Jiunge na simu", "room.peopleOnCamera": "Watu wanazungumza kwa video.",
	"room.notConnected": "Hakuna muunganisho — inaunganisha upya…", "room.ended": "Mkutano umeisha", "room.openingRecap": "Inafungua muhtasari…",
	"room.notInRoom": "Hauko kwenye chumba hiki.", "room.connectionClosed": "Muunganisho umefungwa.", "room.tryAgain": "Jaribu tena", "room.dashboard": "Dashibodi",
	"transcript.title": "Nakala", "transcript.empty": "Washa maikrofoni au andika hapa chini. Kila mtu anaona nakala moja kwa moja.",
	"transcript.listening": "Inasikiliza… au andika hapa", "transcript.say": "Sema kitu kwa chumba…", "transcript.micOn": "Washa maikrofoni", "transcript.micOff": "Zima maikrofoni",
	"transcript.send": "Tuma", "transcript.you": "Wewe", "transcript.language": "Lugha",
	"call.mute": "Zima maikrofoni", "call.unmute": "Washa maikrofoni", "call.cameraOff": "Zima kamera", "call.cameraOn": "Washa kamera",
	"call.share": "Shiriki skrini", "call.stopShare": "Acha kuwasilisha", "call.saverOn": "Kuokoa data kumewashwa (360p)", "call.saverOff": "Kuokoa data kumezimwa",
	"call.leave": "Ondoka", "call.presenting": "{name} anawasilisha", "call.you": "wewe",
	"chat.empty": "Ujumbe na faili zinazoshirikiwa hapa zinabaki kwenye muhtasari wa mkutano.", "chat.placeholder": "Tuma ujumbe kwa wote…", "chat.attach": "Ambatisha faili", "chat.send": "Tuma ujumbe", "chat.tooBig": "Faili zisizidi MB 10",
	"invite.title": "Alika watu", "invite.desc": "Mtu yeyote mwenye kiungo anaweza kujiunga kwa jina lake tu.", "invite.copy": "Nakili", "invite.copied": "Imenakiliwa", "invite.email": "Barua pepe", "invite.more": "Zaidi",
	"invite.message": "Jiunge na \"{title}\" kwenye Quorum: {url}", "common.close": "Funga",
	"catchup.title": "Ulichokosa", "catchup.nothing": "Bado hakuna kitu — umefika kwa wakati.", "catchup.decided": "Imeamuliwa", "catchup.assigned": "Imekabidhiwa",
	"feed.empty": "Uhakiki wa ukweli, maamuzi, majukumu na changamoto huonekana hapa mazungumzo yanapoendelea.", "feed.searching": "inatafuta…", "feed.correction": "Marekebisho",
	"feed.decision": "Uamuzi", "feed.approved": "Imeidhinishwa", "feed.declined": "Imekataliwa", "feed.rejected": "Imekataliwa", "feed.by": "na", "feed.due": "Mwisho", "feed.challenge": "Changamoto",
	"verdict.checking": "Inahakiki", "verdict.supported": "Ni kweli", "verdict.disputed": "Inabishaniwa", "verdict.refuted": "Si kweli", "verdict.unverifiable": "Haiwezi kuhakikiwa", "verdict.failed": "Imeshindwa", "verdict.dismissed": "Si dai",
	"recall.contradicts": "Inapingana na uamuzi wa awali", "recall.supports": "Inaendana na awali", "recall.context": "Kutoka mkutano uliopita",
	"approval.needs": "Inahitaji idhini yako", "approval.paused": "Wakala amesimama hadi mtu katika chumba aamue.", "approval.approve": "Idhinisha", "approval.reject": "Kataa",
	"orbit.working": "{n} wanafanya kazi", "orbit.listening": "inasikiliza", "orbit.topics": "Mada zinaonekana unapozungumza",
	"agent.scribe": "Mwandishi", "agent.fact_checker": "Mhakiki wa Ukweli", "agent.researcher": "Mtafiti", "agent.decision_tracker": "Mfuatiliaji wa Maamuzi", "agent.action_owner": "Msimamizi wa Majukumu", "agent.devils_advocate": "Mpinzani", "agent.memory_keeper": "Mtunza Kumbukumbu",
	"phase.listening": "Inasikiliza", "phase.queued": "Kwenye foleni", "phase.thinking": "Inafikiri", "phase.tool": "Inatafiti", "phase.answering": "Inaandika", "phase.paused": "Inakusubiri", "phase.degraded": "Imeharibika",
}

const ar: Dict = {
	"status.connecting": "جارٍ الاتصال", "status.live": "مباشر", "status.reconnecting": "إعادة الاتصال", "status.offline": "غير متصل", "status.closed": "مغلق",
	"room.tokens": "رموز", "room.catchUp": "أطلعني على ما فاتني", "room.invite": "دعوة", "room.end": "إنهاء", "room.confirmEnd": "تأكيد الإنهاء",
	"room.tab.call": "المكالمة", "room.tab.transcript": "النص", "room.tab.cards": "البطاقات", "room.agentWork": "عمل الوكلاء", "room.chat": "الدردشة",
	"room.summarySoFar": "الملخص حتى الآن", "room.everyoneCanTalk": "يمكن للجميع التحدث وجهاً لوجه — والوكلاء يستمعون.",
	"room.joinWithCamera": "انضم بالكاميرا", "room.joinCall": "انضم إلى المكالمة", "room.peopleOnCamera": "هناك أشخاص يتحدثون بالفيديو.",
	"room.notConnected": "غير متصل — جارٍ إعادة الاتصال…", "room.ended": "انتهى الاجتماع", "room.openingRecap": "جارٍ فتح الملخص…",
	"room.notInRoom": "أنت لست في هذه الغرفة.", "room.connectionClosed": "تم إغلاق الاتصال.", "room.tryAgain": "حاول مجدداً", "room.dashboard": "لوحة التحكم",
	"transcript.title": "النص", "transcript.empty": "شغّل الميكروفون أو اكتب أدناه. يرى الجميع النص مباشرة.",
	"transcript.listening": "أستمع… أو اكتب هنا", "transcript.say": "قل شيئاً للغرفة…", "transcript.micOn": "تشغيل الميكروفون", "transcript.micOff": "إيقاف الميكروفون",
	"transcript.send": "إرسال", "transcript.you": "أنت", "transcript.language": "اللغة",
	"call.mute": "كتم الميكروفون", "call.unmute": "إلغاء كتم الميكروفون", "call.cameraOff": "إيقاف الكاميرا", "call.cameraOn": "تشغيل الكاميرا",
	"call.share": "مشاركة الشاشة", "call.stopShare": "إيقاف العرض", "call.saverOn": "توفير البيانات مفعّل (360p)", "call.saverOff": "توفير البيانات متوقف",
	"call.leave": "مغادرة", "call.presenting": "{name} يعرض الشاشة", "call.you": "أنت",
	"chat.empty": "الرسائل والملفات المشاركة هنا تبقى مع ملخص الاجتماع.", "chat.placeholder": "رسالة للجميع…", "chat.attach": "إرفاق ملف", "chat.send": "إرسال الرسالة", "chat.tooBig": "الحد الأقصى للملف 10 ميغابايت",
	"invite.title": "دعوة أشخاص", "invite.desc": "يمكن لأي شخص لديه الرابط الانضمام باسمه فقط.", "invite.copy": "نسخ", "invite.copied": "تم النسخ", "invite.whatsapp": "واتساب", "invite.email": "البريد", "invite.more": "المزيد",
	"invite.message": "انضم إلى \"{title}\" على Quorum: {url}", "common.close": "إغلاق",
	"catchup.title": "ما فاتك", "catchup.nothing": "لا شيء بعد — وصلت في الوقت المناسب.", "catchup.decided": "تقرّر", "catchup.assigned": "مُسند",
	"feed.empty": "تظهر هنا عمليات التحقق والقرارات والمهام والاعتراضات أثناء المحادثة.", "feed.searching": "جارٍ البحث…", "feed.correction": "تصحيح",
	"feed.decision": "قرار", "feed.approved": "تمت الموافقة", "feed.declined": "مرفوض", "feed.rejected": "مرفوض", "feed.by": "بواسطة", "feed.due": "الموعد", "feed.challenge": "اعتراض",
	"verdict.checking": "جارٍ التحقق", "verdict.supported": "صحيح", "verdict.disputed": "موضع خلاف", "verdict.refuted": "خاطئ", "verdict.unverifiable": "لا يمكن التحقق", "verdict.failed": "فشل التحقق", "verdict.dismissed": "ليس ادعاءً",
	"recall.contradicts": "يتعارض مع قرار سابق", "recall.supports": "متّسق مع ما سبق", "recall.context": "من اجتماع سابق",
	"approval.needs": "يحتاج إلى موافقتك", "approval.paused": "الوكيل متوقف حتى يقرر أحد الحاضرين.", "approval.approve": "موافقة", "approval.reject": "رفض",
	"orbit.working": "{n} يعملون", "orbit.listening": "يستمع", "orbit.topics": "تظهر المواضيع أثناء حديثك",
	"agent.scribe": "الكاتب", "agent.fact_checker": "مدقق الحقائق", "agent.researcher": "الباحث", "agent.decision_tracker": "متتبع القرارات", "agent.action_owner": "مسؤول المهام", "agent.devils_advocate": "محامي الشيطان", "agent.memory_keeper": "حافظ الذاكرة",
	"phase.listening": "يستمع", "phase.queued": "في الانتظار", "phase.thinking": "يفكر", "phase.tool": "يبحث", "phase.answering": "يكتب", "phase.paused": "بانتظارك", "phase.degraded": "متعطل",
}

const af: Dict = {
	"status.connecting": "Verbind", "status.live": "Regstreeks", "status.reconnecting": "Herverbind", "status.offline": "Vanlyn", "status.closed": "Gesluit",
	"room.catchUp": "Bring my op hoogte", "room.invite": "Nooi", "room.end": "Beëindig", "room.confirmEnd": "Bevestig einde",
	"room.tab.call": "Oproep", "room.tab.transcript": "Transkripsie", "room.tab.cards": "Kaarte", "room.agentWork": "Agente se werk", "room.chat": "Klets",
	"room.summarySoFar": "Opsomming tot dusver", "room.everyoneCanTalk": "Almal kan van aangesig tot aangesig praat — die agente luister saam.",
	"room.joinWithCamera": "Sluit aan met kamera", "room.joinCall": "Sluit by oproep aan", "room.peopleOnCamera": "Mense praat op kamera.",
	"room.notConnected": "Nie gekoppel nie — herverbind…", "room.ended": "Die vergadering het geëindig", "room.openingRecap": "Maak die opsomming oop…",
	"room.notInRoom": "Jy is nie in hierdie kamer nie.", "room.connectionClosed": "Die verbinding is gesluit.", "room.tryAgain": "Probeer weer", "room.dashboard": "Paneelbord",
	"transcript.title": "Transkripsie", "transcript.empty": "Skakel jou mikrofoon aan of tik hieronder. Almal sien die transkripsie regstreeks.",
	"transcript.listening": "Luister… of tik hier", "transcript.say": "Sê iets vir die kamer…", "transcript.micOn": "Skakel mikrofoon aan", "transcript.micOff": "Skakel mikrofoon af",
	"transcript.send": "Stuur", "transcript.you": "Jy", "transcript.language": "Taal",
	"call.mute": "Demp mikrofoon", "call.unmute": "Ontdemp mikrofoon", "call.cameraOff": "Skakel kamera af", "call.cameraOn": "Skakel kamera aan",
	"call.share": "Deel skerm", "call.stopShare": "Hou op aanbied", "call.saverOn": "Databespaarder aan (360p)", "call.saverOff": "Databespaarder af",
	"call.leave": "Verlaat", "call.presenting": "{name} bied aan", "call.you": "jy",
	"chat.empty": "Boodskappe en lêers wat hier gedeel word, bly by die vergadering se opsomming.", "chat.placeholder": "Boodskap aan almal…", "chat.attach": "Heg lêer aan", "chat.send": "Stuur boodskap", "chat.tooBig": "Lêers tot 10 MB",
	"invite.title": "Nooi mense", "invite.desc": "Enigiemand met die skakel kan met net hul naam aansluit.", "invite.copy": "Kopieer", "invite.copied": "Gekopieer", "invite.email": "E-pos", "invite.more": "Meer",
	"invite.message": "Sluit aan by \"{title}\" op Quorum: {url}", "common.close": "Maak toe",
	"catchup.title": "Wat jy gemis het", "catchup.nothing": "Nog niks nie — jy is betyds.", "catchup.decided": "Besluit", "catchup.assigned": "Toegewys",
	"feed.empty": "Feitekontroles, besluite, aksie-items en uitdagings verskyn hier soos die gesprek vorder.", "feed.searching": "soek…", "feed.correction": "Regstelling",
	"feed.decision": "Besluit", "feed.approved": "Goedgekeur", "feed.declined": "Afgewys", "feed.rejected": "Verwerp", "feed.by": "deur", "feed.due": "Sperdatum", "feed.challenge": "Uitdaging",
	"verdict.checking": "Kontroleer", "verdict.supported": "Bevestig", "verdict.disputed": "Betwis", "verdict.refuted": "Vals", "verdict.unverifiable": "Kan nie bevestig nie", "verdict.failed": "Misluk", "verdict.dismissed": "Nie 'n bewering nie",
	"recall.contradicts": "Weerspreek 'n vroeëre besluit", "recall.supports": "Strook met voorheen", "recall.context": "Uit 'n vroeëre vergadering",
	"approval.needs": "Benodig jou goedkeuring", "approval.paused": "Die agent wag totdat iemand in die kamer besluit.", "approval.approve": "Keur goed", "approval.reject": "Verwerp",
	"orbit.working": "{n} werk", "orbit.listening": "luister", "orbit.topics": "Onderwerpe verskyn terwyl jy praat",
	"agent.scribe": "Skrywer", "agent.fact_checker": "Feitekontroleerder", "agent.researcher": "Navorser", "agent.decision_tracker": "Besluitopspoorder", "agent.action_owner": "Aksie-eienaar", "agent.devils_advocate": "Duiwelsadvokaat", "agent.memory_keeper": "Geheuebewaarder",
	"phase.listening": "Luister", "phase.queued": "In tou", "phase.thinking": "Dink", "phase.tool": "Soek", "phase.answering": "Skryf", "phase.paused": "Wag vir jou", "phase.degraded": "Verswak",
}

const zu: Dict = {
	"status.connecting": "Iyaxhuma", "status.live": "Bukhoma", "status.reconnecting": "Iyaxhuma kabusha", "status.offline": "Akuxhunyiwe", "status.closed": "Kuvaliwe",
	"room.catchUp": "Ngitshele engikuphuthile", "room.invite": "Mema", "room.end": "Qeda", "room.confirmEnd": "Qinisekisa ukuqeda",
	"room.tab.call": "Ikholi", "room.tab.transcript": "Umbhalo", "room.tab.cards": "Amakhadi", "room.agentWork": "Umsebenzi wama-ejenti", "room.chat": "Ingxoxo",
	"room.summarySoFar": "Isifinyezo kuze kube manje", "room.everyoneCanTalk": "Wonke umuntu angakhuluma ubuso nobuso — ama-ejenti ayalalela.",
	"room.joinWithCamera": "Joyina ngekhamera", "room.joinCall": "Joyina ikholi", "room.peopleOnCamera": "Abantu bakhuluma ngevidiyo.",
	"room.notConnected": "Akuxhunyiwe — iyaxhuma kabusha…", "room.ended": "Umhlangano uphelile", "room.openingRecap": "Kuvulwa isifinyezo…",
	"room.notInRoom": "Awukho kuleli gumbi.", "room.connectionClosed": "Uxhumano luvaliwe.", "room.tryAgain": "Zama futhi", "room.dashboard": "Ideshibhodi",
	"transcript.title": "Umbhalo", "transcript.empty": "Vula imakrofoni noma ubhale ngezansi. Wonke umuntu ubona umbhalo bukhoma.",
	"transcript.listening": "Iyalalela… noma bhala lapha", "transcript.say": "Sho okuthile egumbini…", "transcript.micOn": "Vula imakrofoni", "transcript.micOff": "Vala imakrofoni",
	"transcript.send": "Thumela", "transcript.you": "Wena", "transcript.language": "Ulimi",
	"call.mute": "Thulisa imakrofoni", "call.unmute": "Vula imakrofoni", "call.cameraOff": "Vala ikhamera", "call.cameraOn": "Vula ikhamera",
	"call.share": "Yabelana ngesikrini", "call.stopShare": "Yeka ukwethula", "call.saverOn": "Ukonga idatha kuvuliwe (360p)", "call.saverOff": "Ukonga idatha kuvaliwe",
	"call.leave": "Phuma", "call.presenting": "U-{name} uyethula", "call.you": "wena",
	"chat.empty": "Imilayezo namafayela abiwe lapha ahlala nesifinyezo somhlangano.", "chat.placeholder": "Bhalela wonke umuntu…", "chat.attach": "Namathisela ifayela", "chat.send": "Thumela umlayezo", "chat.tooBig": "Amafayela afika ku-10 MB",
	"invite.title": "Mema abantu", "invite.desc": "Noma ubani onelinki angajoyina ngegama lakhe kuphela.", "invite.copy": "Kopisha", "invite.copied": "Kukopishiwe", "invite.email": "I-imeyili", "invite.more": "Okuningi",
	"invite.message": "Joyina \"{title}\" ku-Quorum: {url}", "common.close": "Vala",
	"catchup.title": "Okuphuthile", "catchup.nothing": "Akukho okwamanje — ufike ngesikhathi.", "catchup.decided": "Kunqunyiwe", "catchup.assigned": "Kunikeziwe",
	"feed.empty": "Ukuhlola amaqiniso, izinqumo, imisebenzi nezinselelo kuvela lapha njengoba ingxoxo iqhubeka.", "feed.searching": "iyasesha…", "feed.correction": "Ukulungisa",
	"feed.decision": "Isinqumo", "feed.approved": "Kuvunyiwe", "feed.declined": "Kwenqatshiwe", "feed.rejected": "Kwenqatshiwe", "feed.by": "ngu", "feed.due": "Kufanele", "feed.challenge": "Inselelo",
	"verdict.checking": "Iyahlola", "verdict.supported": "Kuyiqiniso", "verdict.disputed": "Kuyaphikiswa", "verdict.refuted": "Akulona iqiniso", "verdict.unverifiable": "Akuqinisekiseki", "verdict.failed": "Kuhlulekile", "verdict.dismissed": "Akusona isimangalo",
	"recall.contradicts": "Kuphikisana nesinqumo sangaphambili", "recall.supports": "Kuyavumelana nangaphambili", "recall.context": "Kusukela emhlanganweni odlule",
	"approval.needs": "Kudinga imvume yakho", "approval.paused": "I-ejenti imisiwe kuze kube umuntu egumbini uyanquma.", "approval.approve": "Vuma", "approval.reject": "Yenqaba",
	"orbit.working": "{n} ayasebenza", "orbit.listening": "iyalalela", "orbit.topics": "Izihloko zivela njengoba ukhuluma",
	"agent.scribe": "Umbhali", "agent.fact_checker": "Umhloli Wamaqiniso", "agent.researcher": "Umcwaningi", "agent.decision_tracker": "Umlandeli Wezinqumo", "agent.action_owner": "Umphathi Wemisebenzi", "agent.devils_advocate": "Umphikisi", "agent.memory_keeper": "Umgcini Wenkumbulo",
	"phase.listening": "Iyalalela", "phase.queued": "Ilindile", "phase.thinking": "Iyacabanga", "phase.tool": "Iyacwaninga", "phase.answering": "Iyabhala", "phase.paused": "Ikulindile", "phase.degraded": "Ayisebenzi kahle",
}

const am: Dict = {
	"status.connecting": "በመገናኘት ላይ", "status.live": "በቀጥታ", "status.reconnecting": "እንደገና በመገናኘት ላይ", "status.offline": "ከመስመር ውጭ", "status.closed": "ተዘግቷል",
	"room.catchUp": "ያመለጠኝን አሳውቀኝ", "room.invite": "ጋብዝ", "room.end": "ጨርስ", "room.confirmEnd": "መጨረስን አረጋግጥ",
	"room.tab.call": "ጥሪ", "room.tab.transcript": "ግልባጭ", "room.tab.cards": "ካርዶች", "room.agentWork": "የወኪሎች ስራ", "room.chat": "ውይይት",
	"room.summarySoFar": "እስካሁን ያለው ማጠቃለያ", "room.everyoneCanTalk": "ሁሉም ፊት ለፊት መነጋገር ይችላል — ወኪሎቹ ያዳምጣሉ።",
	"room.joinWithCamera": "በካሜራ ተቀላቀል", "room.joinCall": "ጥሪውን ተቀላቀል", "room.peopleOnCamera": "ሰዎች በቪዲዮ እየተነጋገሩ ነው።",
	"room.notConnected": "አልተገናኘም — እንደገና በመገናኘት ላይ…", "room.ended": "ስብሰባው አብቅቷል", "room.openingRecap": "ማጠቃለያው በመከፈት ላይ…",
	"room.notInRoom": "በዚህ ክፍል ውስጥ አይደሉም።", "room.connectionClosed": "ግንኙነቱ ተዘግቷል።", "room.tryAgain": "እንደገና ሞክር", "room.dashboard": "ዳሽቦርድ",
	"transcript.title": "ግልባጭ", "transcript.empty": "ማይክሮፎንዎን ያብሩ ወይም ከታች ይጻፉ። ሁሉም ግልባጩን በቀጥታ ያያል።",
	"transcript.listening": "በማዳመጥ ላይ… ወይም እዚህ ይጻፉ", "transcript.say": "ለክፍሉ የሆነ ነገር ይናገሩ…", "transcript.micOn": "ማይክሮፎን አብራ", "transcript.micOff": "ማይክሮፎን አጥፋ",
	"transcript.send": "ላክ", "transcript.you": "እርስዎ", "transcript.language": "ቋንቋ",
	"call.mute": "ማይክሮፎን ዝጋ", "call.unmute": "ማይክሮፎን ክፈት", "call.cameraOff": "ካሜራ አጥፋ", "call.cameraOn": "ካሜራ አብራ",
	"call.share": "ስክሪን አጋራ", "call.stopShare": "ማቅረብ አቁም", "call.saverOn": "ዳታ ቆጣቢ በርቷል (360p)", "call.saverOff": "ዳታ ቆጣቢ ጠፍቷል",
	"call.leave": "ውጣ", "call.presenting": "{name} እያቀረበ ነው", "call.you": "እርስዎ",
	"chat.empty": "እዚህ የሚጋሩ መልዕክቶችና ፋይሎች ከስብሰባው ማጠቃለያ ጋር ይቀመጣሉ።", "chat.placeholder": "ለሁሉም መልዕክት…", "chat.attach": "ፋይል አያይዝ", "chat.send": "መልዕክት ላክ", "chat.tooBig": "ፋይሎች እስከ 10 MB",
	"invite.title": "ሰዎችን ጋብዝ", "invite.desc": "ሊንኩ ያለው ማንኛውም ሰው በስሙ ብቻ መቀላቀል ይችላል።", "invite.copy": "ቅዳ", "invite.copied": "ተቀድቷል", "invite.email": "ኢሜይል", "invite.more": "ተጨማሪ",
	"invite.message": "በQuorum ላይ \"{title}\"ን ይቀላቀሉ፦ {url}", "common.close": "ዝጋ",
	"catchup.title": "ያመለጠዎት", "catchup.nothing": "እስካሁን ምንም የለም — በሰዓቱ ደርሰዋል።", "catchup.decided": "የተወሰነ", "catchup.assigned": "የተመደበ",
	"feed.empty": "የእውነታ ማረጋገጫዎች፣ ውሳኔዎች፣ ተግባራት እና ተቃውሞዎች ውይይቱ ሲቀጥል እዚህ ይታያሉ።", "feed.searching": "በመፈለግ ላይ…", "feed.correction": "እርማት",
	"feed.decision": "ውሳኔ", "feed.approved": "ጸድቋል", "feed.declined": "ተቀባይነት አላገኘም", "feed.rejected": "ውድቅ ተደርጓል", "feed.by": "በ", "feed.due": "የመጨረሻ ቀን", "feed.challenge": "ተቃውሞ",
	"verdict.checking": "በማረጋገጥ ላይ", "verdict.supported": "እውነት", "verdict.disputed": "አከራካሪ", "verdict.refuted": "ሐሰት", "verdict.unverifiable": "ማረጋገጥ አይቻልም", "verdict.failed": "አልተሳካም", "verdict.dismissed": "የይገባኛል ጥያቄ አይደለም",
	"recall.contradicts": "ከቀድሞ ውሳኔ ጋር ይጋጫል", "recall.supports": "ከቀድሞው ጋር ይስማማል", "recall.context": "ካለፈው ስብሰባ",
	"approval.needs": "የእርስዎን ፈቃድ ይፈልጋል", "approval.paused": "ወኪሉ በክፍሉ ውስጥ ያለ ሰው እስኪወስን ቆሟል።", "approval.approve": "አጽድቅ", "approval.reject": "ውድቅ አድርግ",
	"orbit.working": "{n} በስራ ላይ", "orbit.listening": "በማዳመጥ ላይ", "orbit.topics": "ሲናገሩ ርዕሶች ይታያሉ",
	"agent.scribe": "ጸሐፊ", "agent.fact_checker": "እውነታ አረጋጋጭ", "agent.researcher": "ተመራማሪ", "agent.decision_tracker": "ውሳኔ ተከታታይ", "agent.action_owner": "የተግባር ባለቤት", "agent.devils_advocate": "ተቃዋሚ", "agent.memory_keeper": "የትውስታ ጠባቂ",
	"phase.listening": "በማዳመጥ ላይ", "phase.queued": "በወረፋ", "phase.thinking": "በማሰብ ላይ", "phase.tool": "በመመርመር ላይ", "phase.answering": "በመጻፍ ላይ", "phase.paused": "እርስዎን በመጠበቅ ላይ", "phase.degraded": "ተበላሽቷል",
}

const DICTS: Record<string, Dict> = { en, fr, pt, sw, ar, af, zu, am }
const RTL = new Set(["ar"])

export function localeOf(speechLang: string): string {
	const base = speechLang.split("-")[0] ?? "en"
	return base in DICTS ? base : "en"
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

function translator(locale: string): Translate {
	const dict = DICTS[locale] ?? en
	return (key, vars) => {
		let s = dict[key] ?? en[key]
		if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
		return s
	}
}

interface I18n {
	lang: string
	locale: string
	dir: "ltr" | "rtl"
	setLang: (lang: string) => void
	t: Translate
}

const I18nContext = createContext<I18n>({ lang: "en-NG", locale: "en", dir: "ltr", setLang: () => {}, t: translator("en") })

const noopSubscribe = () => () => {}

export function I18nProvider({ children }: { children: ReactNode }) {
	// Until the user picks, follow their saved/browser language (read on the client only).
	const detected = useSyncExternalStore(noopSubscribe, defaultSpeechLanguage, () => "en-NG")
	const [chosen, setLangState] = useState<string | null>(null)
	const lang = chosen ?? detected

	const setLang = useCallback((next: string) => {
		setLangState(next)
		try {
			window.localStorage.setItem(LANGUAGE_KEY, next)
		} catch {
			/* storage unavailable */
		}
	}, [])

	const locale = localeOf(lang)
	const dir = RTL.has(locale) ? "rtl" : "ltr"
	useEffect(() => {
		document.documentElement.lang = lang
		document.documentElement.dir = dir
	}, [lang, dir])

	const value = useMemo<I18n>(() => ({ lang, locale, dir, setLang, t: translator(locale) }), [lang, locale, dir, setLang])
	return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n(): I18n {
	return useContext(I18nContext)
}
