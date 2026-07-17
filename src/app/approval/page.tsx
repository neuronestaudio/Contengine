import { redirect } from "next/navigation";

// Awaiting-approval now lives on the Import & Approve tab. Keep this route as a
// redirect so old links/bookmarks don't 404.
export default function ApprovalRedirect() {
  redirect("/import");
}
