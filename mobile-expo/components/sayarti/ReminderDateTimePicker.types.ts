import type { Language } from "@/lib/sayarti/i18n";

export type ReminderDateTimePickerProps = {
  value: Date;
  onChange: (value: Date) => void;
  onValidityChange?: (valid: boolean) => void;
  language: Language;
  isRTL: boolean;
  labels: {
    date: string;
    time: string;
    dateInputHint: string;
    timeInputHint: string;
  };
  colors: {
    ink: string;
    muted: string;
    surface: string;
    line: string;
    green: string;
  };
};
