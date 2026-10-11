import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LanguagePreference = "auto" | "id" | "en";
export type Locale = "id" | "en";

const copy = {
  id: {
    home: "Beranda", discover: "Temukan", notifications: "Notifikasi", messages: "Pesan", profile: "Profil",
    follow: "Ikuti", following: "Mengikuti", language: "Bahasa", automatic: "Otomatis",
    indonesian: "Bahasa Indonesia", english: "English",
    groups: "Grup", createGroup: "Buat grup", verifyAccount: "Verifikasi akun", bookmarks: "Bookmark", supportCenter: "Dukungan & Tentang", soon: "SEGERA",
    whatsHappening: "Apa yang sedang terjadi?", post: "Post", noPosts: "Belum ada postingan. Mulai percakapan!",
    comments: "Komentar", repost: "Remind", likePost: "Suka postingan; tahan untuk pilihan reaksi", reactionChoices: "Pilihan reaksi",
    like: "Suka", removeBookmark: "Hapus bookmark", bookmark: "Bookmark", postMenu: "Menu postingan",
    editPost: "Edit postingan", deletePost: "Hapus postingan", report: "Laporkan", writeComment: "Tulis komentar…",
    reply: "Balas", deleteComment: "Hapus komentar", updatePost: "Perbarui isi postingan Anda.", cancel: "Batal", save: "Simpan",
    reportPost: "Laporkan postingan", reportPrivate: "Pilih alasan yang paling sesuai. Laporan Anda bersifat privat.",
    reason: "Alasan", sendReport: "Kirim laporan", spam: "Spam", harassment: "Pelecehan", misinformation: "Informasi menyesatkan",
    illegal: "Konten ilegal", other: "Lainnya", postUpdated: "Postingan diperbarui", postDeleted: "Postingan dihapus",
    bookmarkRemoved: "Bookmark dihapus", postSaved: "Postingan disimpan", reportSent: "Laporan terkirim",
    reportThanks: "Terima kasih telah membantu menjaga komunitas.", reactionFailed: "Gagal memberi reaksi.",
    editProfile: "Edit profil", posts: "Postingan", name: "Nama", bio: "Bio", changePhoto: "Ganti foto", remove: "Hapus",
    noUsername: "Belum ada username", signOut: "Keluar", shareProfile: "Bagikan profil", betaAccess: "Beta akses", reload: "Muat ulang",
  },
  en: {
    home: "Home", discover: "Discover", notifications: "Notifications", messages: "Messages", profile: "Profile",
    follow: "Follow", following: "Following", language: "Language", automatic: "Automatic",
    indonesian: "Bahasa Indonesia", english: "English",
    groups: "Groups", createGroup: "Create group", verifyAccount: "Verify account", bookmarks: "Bookmarks", supportCenter: "Support & About", soon: "SOON",
    whatsHappening: "What's happening?", post: "Post", noPosts: "No posts yet. Start the conversation!",
    comments: "Comments", repost: "Remind", likePost: "Like post; hold for more reactions", reactionChoices: "Reaction choices",
    like: "Like", removeBookmark: "Remove bookmark", bookmark: "Bookmark", postMenu: "Post menu",
    editPost: "Edit post", deletePost: "Delete post", report: "Report", writeComment: "Write a comment…",
    reply: "Reply", deleteComment: "Delete comment", updatePost: "Update your post.", cancel: "Cancel", save: "Save",
    reportPost: "Report post", reportPrivate: "Choose the best reason. Your report is private.",
    reason: "Reason", sendReport: "Send report", spam: "Spam", harassment: "Harassment", misinformation: "Misinformation",
    illegal: "Illegal content", other: "Other", postUpdated: "Post updated", postDeleted: "Post deleted",
    bookmarkRemoved: "Bookmark removed", postSaved: "Post saved", reportSent: "Report sent",
    reportThanks: "Thank you for helping keep the community safe.", reactionFailed: "Could not add reaction.",
    editProfile: "Edit profile", posts: "Posts", name: "Name", bio: "Bio", changePhoto: "Change photo", remove: "Remove",
    noUsername: "No username yet", signOut: "Sign out", shareProfile: "Share profile", betaAccess: "Beta access", reload: "Reload",
  },
} as const;

type CopyKey = keyof typeof copy.id;
type PreferencesValue = {
  language: LanguagePreference; setLanguage: (value: LanguagePreference) => void;
  locale: Locale; t: (key: CopyKey) => string;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguagePreference>("en");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("mindcaster-language") as LanguagePreference | null;
    if (savedLanguage === "auto" || savedLanguage === "id" || savedLanguage === "en") setLanguageState(savedLanguage);
  }, []);

  // Appearance is fixed to the light theme; the previous light/dark toggle was removed.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
    window.localStorage.removeItem("mindcaster-theme");
  }, []);

  const locale: Locale = "en";
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const value = useMemo<PreferencesValue>(() => ({
    language,
    setLanguage: (next) => { setLanguageState(next); window.localStorage.setItem("mindcaster-language", next); },
    locale,
    t: (key) => copy[locale][key],
  }), [language, locale]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// Fallback keeps the app rendering (English default) if the provider is briefly
// missing, e.g. after a hot reload creates a fresh context instance.
const fallbackPreferences: PreferencesValue = {
  language: "en",
  setLanguage: (next) => { if (typeof window !== "undefined") { window.localStorage.setItem("mindcaster-language", next); window.location.reload(); } },
  locale: "en",
  t: (key) => copy.en[key],
};

export function usePreferences() {
  return useContext(PreferencesContext) ?? fallbackPreferences;
}
