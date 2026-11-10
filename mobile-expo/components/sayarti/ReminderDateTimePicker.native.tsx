import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, View } from "react-native";

import type { ReminderDateTimePickerProps } from "./ReminderDateTimePicker.types";

const localeFor = (language: ReminderDateTimePickerProps["language"]) =>
  language === "ar" ? "ar-DZ" : language === "fr" ? "fr-DZ" : "en-DZ";

const withDate = (current: Date, picked: Date) => {
  const next = new Date(current);
  next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return next;
};

const withTime = (current: Date, picked: Date) => {
  const next = new Date(current);
  next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return next;
};

export function ReminderDateTimePicker({
  value,
  onChange,
  language,
  isRTL,
  labels,
  colors,
}: ReminderDateTimePickerProps) {
  const locale = localeFor(language);
  const dateLabel = value.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = value.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const buttonStyle = {
    alignItems: "center" as const,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const),
    justifyContent: "space-between" as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
  };
  const valueStyle = { color: colors.ink, fontWeight: "700" as const };

  if (Platform.OS === "ios") {
    return (
      <View style={{ gap: 14 }}>
        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>{labels.date}</Text>
          <DateTimePicker
            value={value}
            mode="date"
            display="compact"
            minimumDate={new Date()}
            locale={locale}
            accentColor={colors.green}
            onValueChange={(_, picked) => onChange(withDate(value, picked))}
          />
        </View>
        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>{labels.time}</Text>
          <DateTimePicker
            value={value}
            mode="time"
            display="compact"
            locale={locale}
            accentColor={colors.green}
            onValueChange={(_, picked) => onChange(withTime(value, picked))}
          />
        </View>
      </View>
    );
  }

  const openNativePicker = (mode: "date" | "time") => {
    DateTimePickerAndroid.open({
      value,
      mode,
      display: mode === "date" ? "calendar" : "clock",
      ...(mode === "date" ? { minimumDate: new Date() } : { is24Hour: true }),
      onValueChange: (_, picked) =>
        onChange(mode === "date" ? withDate(value, picked) : withTime(value, picked)),
    });
  };

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => openNativePicker("date")}
        style={buttonStyle}
      >
        <Text style={{ color: colors.muted }}>{labels.date}</Text>
        <Text style={valueStyle}>{dateLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => openNativePicker("time")}
        style={buttonStyle}
      >
        <Text style={{ color: colors.muted }}>{labels.time}</Text>
        <Text style={valueStyle}>{timeLabel}</Text>
      </Pressable>
    </View>
  );
}
