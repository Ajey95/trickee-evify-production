type ChapterWordProps = {
  children: string;
  tone?: "cyan" | "yellow" | "coral";
};

export function ChapterWord({ children, tone = "cyan" }: ChapterWordProps) {
  return (
    <div className={`journey-chapter-word journey-chapter-word--${tone}`} aria-hidden="true" data-chapter-word>
      <span>{children}</span>
      <span>{children}</span>
    </div>
  );
}
