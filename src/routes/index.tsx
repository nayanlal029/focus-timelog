import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/focuslog/AppShell";
import { FocusLogProvider } from "@/lib/focuslog/context";
import { TodayScreen } from "@/components/focuslog/TodayScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FocusLog — Today" },
      { name: "description", content: "Log focus vs distraction time as a continuous timeline." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <FocusLogProvider>
      <AppShell>
        <TodayScreen />
      </AppShell>
    </FocusLogProvider>
  );
}
