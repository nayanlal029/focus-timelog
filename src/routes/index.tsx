import { createFileRoute } from "@tanstack/react-router";
import { TodayScreen } from "@/components/focuslog/TodayScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FocusLog — Timer" },
      { name: "description", content: "Log focus vs distraction time as a continuous timeline." },
    ],
  }),
  component: TodayScreen,
});
