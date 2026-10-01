// C67 ticker.tsx HeadlinesSheet: every cached headline for one name.
import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Card, PushScreen, useC } from "../ui/kit";
import { HeadlineRow } from "../ui/parts";
import { useSlice } from "../ui/slice";

export default function HeadlinesScreen() {
  const { tickerId, macroId } = useLocalSearchParams<{ tickerId?: string; macroId?: string }>();
  const c = useC();
  const s = useSlice();
  const list = s.headlines
    .filter((h) => (tickerId ? h.tickerId === tickerId : macroId ? h.macroId === macroId : true))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return (
    <PushScreen title="Headlines">
      {list.length ? (
        <Card style={{ marginTop: 4 }}>
          {list.map((h, i) => (
            <HeadlineRow key={h.id} h={h} now={s.now} last={i === list.length - 1} compact />
          ))}
        </Card>
      ) : (
        <Text style={{ color: c.faint, fontSize: 13, paddingVertical: 16 }}>No headlines yet.</Text>
      )}
    </PushScreen>
  );
}
