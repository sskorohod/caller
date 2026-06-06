import { redirect } from 'next/navigation';

// Translator was merged into the dashboard hub (/dashboard). Keep this route as
// a redirect so old links/bookmarks still work. Original page in git history.
export default function TranslatorRedirect() {
  redirect('/dashboard');
}
