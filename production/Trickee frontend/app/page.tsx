import { redirect } from "next/navigation";

export default function Home() {
  // Root page redirects to fleet overview (which handles auth redirect if needed)
  redirect("/fleet");
}
