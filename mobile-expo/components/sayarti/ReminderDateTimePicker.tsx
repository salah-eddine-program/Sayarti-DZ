import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import {
  formatLocalDateInput,
  formatLocalTimeInput,
  parseLocalDateTime,
} from "@/lib/sayarti/records";
import type { ReminderDateTimePickerProps } from "./ReminderDateTimePicker.types";

type DraftFields = { sourceTime: number; date: string; time: string };

export function ReminderDateTimePicker({
  value,
  onChange,
  onValidityChange,
  isRTL,
  labels,
  colors,
}: ReminderDateTimePickerProps) {
  const valueTime = value.getTime();
  const [draft, setDraft] = useState<DraftFields | null>(null);
  const dateText = draft?.sourceTime === valueTime ? draft.date : formatLocalDateInput(value);
  const timeText = draft?.sourceTime === valueTime ? draft.time : formatLocalTimeInput(value);

  const textDirection = {
    writingDirection: isRTL ? ("rtl" as const) : ("ltr" as const),
    textAlign: isRTL ? ("right" as const) : ("left" as const),
  };
  const updateWhenValid = (date: string, time: string) => {
    const next = parseLocalDateTime(date, time);
    onValidityChange?.(!!next);
    if (next) {
      setDraft(null);
      onChange(next);
    } else {
      setDraft({ sourceTime: valueTime, date, time });
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={[{ color: colors.ink, fontWeight: "700" }, textDirection]}>
          {labels.date}
        </Text>
        <TextInput
          value={dateText}
          onChangeText={(next) => updateWhenValid(next, timeText)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderRadius: 12,
            borderWidth: 1,
            color: colors.ink,
            paddingHorizontal: 12,
            paddingVertical: 11,
            writingDirection: "ltr",
            textAlign: "left",
          }}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>{labels.dateInputHint}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[{ color: colors.ink, fontWeight: "700" }, textDirection]}>
          {labels.time}
        </Text>
        <TextInput
          value={timeText}
          onChangeText={(next) => updateWhenValid(dateText, next)}
          placeholder="HH:MM"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderRadius: 12,
            borderWidth: 1,
            color: colors.ink,
            paddingHorizontal: 12,
            paddingVertical: 11,
            writingDirection: "ltr",
            textAlign: "left",
          }}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>{labels.timeInputHint}</Text>
      </View>
    </View>
  );
}
