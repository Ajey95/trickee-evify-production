import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

export function FinalChapter() {
  return (
    <section id="contact" className="journey-final" aria-labelledby="final-title">
      <ChapterWord tone="yellow">MOVE</ChapterWord>
      <div className="journey-final-line" aria-hidden="true"><i /></div>
      <KineticText as="h2" id="final-title" text="Move with foresight." accentWords={["foresight."]} />
      <div className="journey-final-actions">
        <Link href="/fleet" className="journey-primary-action" data-magnetic>Enter operations <ArrowUpRight /></Link>
        <Link href="/signup" className="journey-text-action" data-magnetic>Request fleet access <ArrowUpRight /></Link>
      </div>
      <footer>
        <span>© {new Date().getFullYear()} Trickee</span>
        <nav aria-label="Legal"><Link href="/gpsdriver/privacy">Privacy</Link><Link href="/gpsdriver/terms">Terms</Link><Link href="/gpsdriver/support">Support</Link></nav>
      </footer>
    </section>
  );
}
