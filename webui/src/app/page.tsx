import { getDomains } from "@/lib/domains";
import { DomainList } from "@/components/domain-list";

export const dynamic = "force-dynamic";

export default function Home() {
  const initial = getDomains();

  return (
    <main className="container mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <DomainList initial={initial} />
    </main>
  );
}
