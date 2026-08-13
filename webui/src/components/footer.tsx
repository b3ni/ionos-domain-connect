import { connection } from "next/server";

export async function Footer() {
  await connection();
  const version = process.env.APP_VERSION?.trim() || "dev";

  return (
    <footer className="py-6 text-center text-xs text-muted-foreground">
      Version {version}
    </footer>
  );
}
