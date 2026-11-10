import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BrandMark } from "@/components/sayarti/BrandMark";
import { ReminderDateTimePicker } from "@/components/sayarti/ReminderDateTimePicker";
import {
  initialDocuments,
  initialExpenses,
  initialFuel,
  initialMaintenance,
  initialServicePlans,
  type DocumentItem,
  type ExpenseItem,
  type FuelItem,
  type MaintenanceItem,
  type ServicePlanItem,
} from "@/lib/sayarti/demo-data";
import {
  makeRecordId,
  makeReminderKey,
  getDueReminders,
  isInCalendarMonth,
  isInCalendarYear,
  parseRecordDate,
  parseRecordsSnapshot,
  reminderSoundIds,
  removeSnapshotRecord,
  type RecordKind,
  type ReminderSoundId,
  type ScheduledReminder,
} from "@/lib/sayarti/records";
import {
  parseAccountProfile,
  validateAccountProfile,
  vehicleFuelTypes,
  type AccountProfile,
  type VehicleProfile,
} from "@/lib/sayarti/profile";
import {
  languages,
  t,
  type Language,
  type TranslationKey,
} from "@/lib/sayarti/i18n";
import {
  EmailAuthError,
  logoutEmailSession,
  requestEmailCode,
  restoreEmailSession,
  verifyEmailCode,
} from "@/lib/sayarti/email-auth";

type Page =
  | "home"
  | "maintenance"
  | "expenses"
  | "documents"
  | "settings"
  | "welcome"
  | "login"
  | "register"
  | "vehicle";
type TabPage = Extract<
  Page,
  "home" | "maintenance" | "expenses" | "documents" | "settings"
>;
type FormKind = RecordKind | null;
type RecordTarget = { kind: RecordKind; recordId: string; title: string };
type Draft = {
  title: string;
  date: string;
  mileage: string;
  amount: string;
  detail: string;
  liters: string;
  price: string;
  category: string;
};
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const palette = {
  light: {
    bg: "#F5F7F1",
    surface: "#FFFFFF",
    surfaceSoft: "#EDF3E7",
    ink: "#173A2A",
    muted: "#728272",
    line: "#DFE8D9",
    dark: "#02281C",
    green: "#114722",
    greenSoft: "#E8F1E2",
    gold: "#FED439",
    goldSoft: "#FFF7D9",
    orange: "#F58220",
    orangeSoft: "#FFF1DD",
    red: "#D95E52",
    redSoft: "#FCEBE8",
    blue: "#3888B5",
    blueSoft: "#E8F3F9",
    purple: "#8167CF",
  },
  dark: {
    bg: "#0D1811",
    surface: "#17251B",
    surfaceSoft: "#203020",
    ink: "#ECF4E8",
    muted: "#A8B6A1",
    line: "#354735",
    dark: "#071F15",
    green: "#91C84A",
    greenSoft: "#20391F",
    gold: "#FED439",
    goldSoft: "#433A18",
    orange: "#FFAA24",
    orangeSoft: "#463517",
    red: "#EF8277",
    redSoft: "#402927",
    blue: "#6AB0D5",
    blueSoft: "#203847",
    purple: "#A08CE0",
  },
};

const emptyDraft: Draft = {
  title: "",
  date: "",
  mileage: "185200",
  amount: "",
  detail: "",
  liters: "38",
  price: "65.80",
  category: "otherCategory",
};

const reminderSoundFiles: Record<ReminderSoundId, string> = {
  default: "default",
  soft: "sayarti-soft.wav",
  bell: "sayarti-bell.wav",
  alarm: "sayarti-alarm.wav",
};

const reminderSoundTranslationKeys: Record<ReminderSoundId, TranslationKey> = {
  default: "toneDefault",
  soft: "toneSoft",
  bell: "toneBell",
  alarm: "toneAlarm",
};

const todayAsDmy = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${today.getFullYear()}`;
};

const suggestedReminderDateTime = () => {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
};

const emailAuthErrorKey = (error: unknown): TranslationKey => {
  const code = error instanceof EmailAuthError ? error.code : "";
  const messages: Record<string, TranslationKey> = {
    invalid_email: "invalidEmail",
    email_in_use: "emailInUse",
    incorrect_code: "incorrectCode",
    invalid_or_expired_code: "expiredCode",
    too_many_attempts: "tooManyAttempts",
    resend_too_soon: "resendTooSoon",
    account_not_found: "accountNotFound",
    email_sender_unavailable: "emailUnavailable",
    email_delivery_failed: "emailDeliveryFailed",
    api_unavailable: "apiUnavailable",
    network_error: "networkError",
    auth_service_unavailable: "authServiceUnavailable",
    request_limit: "requestLimit",
    profile_required: "profileIncomplete",
    invalid_request: "verificationError",
    storage_unavailable: "profileSaveError",
  };
  return messages[code] ?? "verificationError";
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>("welcome");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupVehicle, setSignupVehicle] = useState<VehicleProfile>({
    brand: "",
    model: "",
    year: "",
    fuel: "diesel",
    mileage: "",
  });
  const [emailAddress, setEmailAddress] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [authStep, setAuthStep] = useState<"details" | "code">("details");
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [accountProfileLoaded, setAccountProfileLoaded] = useState(false);
  const [language, setLanguage] = useState<Language>("ar");
  const [darkMode, setDarkMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [editingTarget, setEditingTarget] = useState<{
    kind: RecordKind;
    recordId: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecordTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] =
    useState<RecordTarget | null>(null);
  const [reminderDateTime, setReminderDateTime] = useState<Date>(
    suggestedReminderDateTime,
  );
  const [selectedReminderSound, setSelectedReminderSound] =
    useState<ReminderSoundId>("default");
  const [scheduleInputValid, setScheduleInputValid] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleOpenId, setScheduleOpenId] = useState(0);
  const [invoiceAttached, setInvoiceAttached] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [notice, setNotice] = useState("");
  const [profileLink, setProfileLink] = useState(
    "https://salah-eddine-program.github.io/bt-salahdine.com/",
  );
  const [vehicle, setVehicle] = useState<VehicleProfile>({
    brand: "Renault",
    model: "Clio 4",
    year: "2018",
    fuel: "diesel",
    mileage: "185200",
  });
  const [maintenanceRecords, setMaintenanceRecords] =
    useState<MaintenanceItem[]>(initialMaintenance);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [fuelRecords, setFuelRecords] = useState<FuelItem[]>(initialFuel);
  const [documentsList, setDocumentsList] =
    useState<DocumentItem[]>(initialDocuments);
  const [servicePlans, setServicePlans] =
    useState<ServicePlanItem[]>(initialServicePlans);
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);

  const c = darkMode ? palette.dark : palette.light;
  const isRTL = language === "ar";
  const tr = (key: TranslationKey) => t(language, key);
  const direction = isRTL ? "row-reverse" : "row";
  const textDirection = {
    writingDirection: isRTL ? ("rtl" as const) : ("ltr" as const),
    textAlign: isRTL ? ("right" as const) : ("left" as const),
  };
  const numberLocale =
    language === "ar" ? "ar-DZ" : language === "fr" ? "fr-DZ" : "en-DZ";
  const money = (amount: number) =>
    `${Math.round(amount).toLocaleString(numberLocale)} ${tr("priceShort")}`;
  const localizeDemoLabel = (label: string) => {
    const equivalents: [TranslationKey, string[]][] = [
      ["oilChange", ["Oil change", "Vidange", "تغيير الزيت"]],
      ["fuelCategory", ["Fuel", "Carburant", "الوقود"]],
      ["serviceCategory", ["Service", "Entretien", "الصيانة"]],
      ["otherCategory", ["Other", "Autre", "أخرى"]],
      ["partsCategory", ["Parts", "Pièces", "قطع الغيار"]],
      ["insurance", ["Insurance", "Assurance", "التأمين"]],
      [
        "technicalCheck",
        ["Technical inspection", "Contrôle technique", "المراقبة التقنية"],
      ],
      ["registration", ["Registration card", "Carte grise", "بطاقة التسجيل"]],
      [
        "drivingLicense",
        [
          "Driving licence",
          "Driving license",
          "Permis de conduire",
          "رخصة السياقة",
        ],
      ],
    ];
    const match = equivalents.find(([, labels]) => labels.includes(label));
    return match ? tr(match[0]) : label;
  };
  const categoryKeyFor = (category: string): TranslationKey => {
    if (["Fuel", "Carburant", "الوقود"].includes(category)) return "fuelCategory";
    if (["Service", "Entretien", "الصيانة"].includes(category)) return "serviceCategory";
    if (["Parts", "Pièces", "قطع الغيار"].includes(category)) return "partsCategory";
    return "otherCategory";
  };
  const calendarNow = new Date();
  const monthlyExpenses = expenses.filter((item) =>
    isInCalendarMonth(item.date, calendarNow),
  );
  const annualExpenses = expenses.filter((item) =>
    isInCalendarYear(item.date, calendarNow),
  );
  const insuranceDocument = documentsList.find(
    (item) =>
      item.id === "document-insurance" ||
      ["Insurance", "Assurance", "التأمين"].includes(item.title),
  );
  const insuranceExpiry = insuranceDocument
    ? parseRecordDate(insuranceDocument.expiry)
    : null;
  const dayNumber = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const insuranceDaysRemaining = insuranceExpiry
    ? Math.max(
        0,
        Math.ceil((dayNumber(insuranceExpiry) - dayNumber(calendarNow)) / 86_400_000),
      )
    : null;
  const insuranceDaysLabel =
    insuranceDaysRemaining === null
      ? tr("dueSoon")
      : insuranceDaysRemaining === 0
        ? language === "ar"
          ? "ينتهي اليوم"
          : language === "fr"
            ? "Échéance aujourd’hui"
            : "Expires today"
        : language === "ar"
          ? insuranceDaysRemaining === 1
            ? "متبقي يوم واحد"
            : `متبقي ${insuranceDaysRemaining} يومًا`
          : language === "fr"
            ? `Dans ${insuranceDaysRemaining} jour${insuranceDaysRemaining === 1 ? "" : "s"}`
            : `In ${insuranceDaysRemaining} day${insuranceDaysRemaining === 1 ? "" : "s"}`;
  const monthlyTotal = monthlyExpenses.reduce((sum, item) => sum + item.amount, 0);
  const annualTotal = annualExpenses.reduce((sum, item) => sum + item.amount, 0);
  const expenseCategoryPresentation = [
    { key: "fuelCategory" as const, icon: "flash-outline" as IoniconName, tint: c.blue },
    { key: "serviceCategory" as const, icon: "construct-outline" as IoniconName, tint: c.green },
    { key: "partsCategory" as const, icon: "cube-outline" as IoniconName, tint: c.purple },
    { key: "otherCategory" as const, icon: "ellipsis-horizontal" as IoniconName, tint: c.orange },
  ];
  const totalForCategory = (source: ExpenseItem[], key: TranslationKey) =>
    source
      .filter((expense) => categoryKeyFor(expense.category) === key)
      .reduce((sum, expense) => sum + expense.amount, 0);
  const monthlyCategoryBreakdown = expenseCategoryPresentation.map((item) => ({
    ...item,
    amount: totalForCategory(monthlyExpenses, item.key),
  }));
  const annualCategoryBreakdown = expenseCategoryPresentation.map((item) => ({
    ...item,
    amount: totalForCategory(annualExpenses, item.key),
  }));
  const fuelEntry = fuelRecords[0] ?? initialFuel[0];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const values = await AsyncStorage.multiGet([
          "sayarti.language",
          "sayarti.darkMode",
          "sayarti.profileLink",
          "sayarti.accountProfile",
          "sayarti.records.v1",
        ]);
        const account = await restoreEmailSession();
        if (cancelled) return;
        const savedLanguage = values[0]?.[1];
        if (
          savedLanguage === "ar" ||
          savedLanguage === "fr" ||
          savedLanguage === "en"
        )
          setLanguage(savedLanguage);
        if (values[1]?.[1] === "true") setDarkMode(true);
        if (values[2]?.[1]) setProfileLink(values[2][1] as string);

        if (account) {
          setIsAuthenticated(true);
          setEmailAddress(account.email);
          setAuthEmail(account.email);
          setFirstName(account.firstName);
          setLastName(account.lastName);
          setSignupFirstName(account.firstName);
          setSignupLastName(account.lastName);
          const savedProfile = parseAccountProfile(values[3]?.[1] ?? "");
          if (savedProfile) {
            setVehicle(savedProfile.vehicle);
            setSignupVehicle(savedProfile.vehicle);
            setPage("home");
          } else {
            setVehicle({ brand: "", model: "", year: "", fuel: "diesel", mileage: "" });
            setPage("vehicle");
          }
        }

        const savedRecords = parseRecordsSnapshot(values[4]?.[1] ?? null);
        setMaintenanceRecords(savedRecords.maintenanceRecords);
        setExpenses(savedRecords.expenses);
        setFuelRecords(savedRecords.fuelRecords);
        setDocumentsList(savedRecords.documentsList);
        setServicePlans(savedRecords.servicePlans);
        setReminders(savedRecords.reminders);
      } catch {
        // Keep the signed-out welcome/demo path available when local storage is unavailable.
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
          setAccountProfileLoaded(true);
          setRecordsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    AsyncStorage.multiSet([
      ["sayarti.language", language],
      ["sayarti.darkMode", String(darkMode)],
      ["sayarti.profileLink", profileLink],
    ]).catch(() => undefined);
  }, [darkMode, language, profileLink, settingsLoaded]);

  useEffect(() => {
    if (!accountProfileLoaded || !isAuthenticated || !firstName.trim() || !lastName.trim()) return;
    const profile: AccountProfile = { firstName, lastName, vehicle };
    if (validateAccountProfile(profile)) return;
    AsyncStorage.setItem("sayarti.accountProfile", JSON.stringify(profile)).catch(
      () => undefined,
    );
  }, [accountProfileLoaded, firstName, isAuthenticated, lastName, vehicle]);

  useEffect(() => {
    if (!recordsLoaded) return;
    AsyncStorage.setItem(
      "sayarti.records.v1",
      JSON.stringify({
        maintenanceRecords,
        expenses,
        fuelRecords,
        documentsList,
        servicePlans,
        reminders,
      }),
    ).catch(() => undefined);
  }, [
    documentsList,
    expenses,
    fuelRecords,
    maintenanceRecords,
    recordsLoaded,
    reminders,
    servicePlans,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (authStep !== "code" || resendCountdown <= 0) return;
    const timer = setInterval(
      () => setResendCountdown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [authStep, resendCountdown]);

  useEffect(() => {
    if (!recordsLoaded) return;
    const checkDueReminders = () => {
      const due = getDueReminders(reminders);
      if (due.length === 0) return;
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        window.Notification.permission === "granted"
      ) {
        due.forEach((item) => {
          try {
            new window.Notification(t(language, "reminderNotificationTitle"), {
              body: `${t(language, "reminderNotificationBody")} · ${item.title}`,
            });
          } catch {
            // The in-app notice below remains available if the browser blocks delivery.
          }
        });
      }
      setNotice(
        `${t(language, "reminderDueNow")}: ${due.map((item) => item.title).join(" · ")}`,
      );
      const dueKeys = new Set(due.map((item) => item.key));
      setReminders((current) =>
        current.map((item) =>
          dueKeys.has(item.key)
            ? { ...item, triggeredAt: new Date().toISOString() }
            : item,
        ),
      );
    };
    checkDueReminders();
    const timer = setInterval(checkDueReminders, 30_000);
    const appStateSubscription =
      Platform.OS === "web"
        ? null
        : AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") checkDueReminders();
          });
    return () => {
      clearInterval(timer);
      appStateSubscription?.remove();
    };
  }, [language, recordsLoaded, reminders]);

  const showNotice = (message = tr("savedToast")) => setNotice(message);

  const makeSignupProfile = (): AccountProfile => ({
      firstName: signupFirstName.trim(),
      lastName: signupLastName.trim(),
      vehicle: {
        ...signupVehicle,
        brand: signupVehicle.brand.trim(),
        model: signupVehicle.model.trim(),
        year: signupVehicle.year.trim(),
        mileage: signupVehicle.mileage.trim(),
      },
    });

  const requestAuthCode = async (register: boolean) => {
    if (authBusy) return;
    setRegistrationError("");
    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (register) {
      const error = validateAccountProfile(makeSignupProfile());
      if (error) {
        setRegistrationError(tr(error));
        return;
      }
    }
    setAuthBusy(true);
    try {
      await requestEmailCode({
        email: normalizedEmail,
        purpose: register ? "signup" : "login",
        language,
      });
      setAuthEmail(normalizedEmail);
      setEmailAddress(normalizedEmail);
      setVerificationCode("");
      setAuthStep("code");
      setResendCountdown(60);
    } catch (error) {
      setRegistrationError(tr(emailAuthErrorKey(error)));
    } finally {
      setAuthBusy(false);
    }
  };

  const submitVerification = async (register: boolean) => {
    if (authBusy) return;
    setRegistrationError("");
    const profile = register ? makeSignupProfile() : null;
    if (profile) {
      const error = validateAccountProfile(profile);
      if (error) {
        setRegistrationError(tr(error));
        setAuthStep("details");
        return;
      }
    }
    if (!/^\d{6}$/.test(verificationCode)) {
      setRegistrationError(tr("verificationError"));
      return;
    }
    setAuthBusy(true);
    try {
      const account = await verifyEmailCode({
        email: authEmail,
        purpose: register ? "signup" : "login",
        language,
        code: verificationCode,
        ...(profile
          ? { firstName: profile.firstName, lastName: profile.lastName }
          : {}),
      });
      setIsAuthenticated(true);
      setAuthEmail(account.email);
      setEmailAddress(account.email);
      setFirstName(account.firstName);
      setLastName(account.lastName);
      setSignupFirstName(account.firstName);
      setSignupLastName(account.lastName);
      setAccountProfileLoaded(true);
      setAuthStep("details");
      setVerificationCode("");

      if (register && profile) {
        try {
          await AsyncStorage.setItem(
            "sayarti.accountProfile",
            JSON.stringify(profile),
          );
        } catch {
          await logoutEmailSession();
          setIsAuthenticated(false);
          setRegistrationError(tr("profileSaveError"));
          return;
        }
        setVehicle(profile.vehicle);
        setSignupVehicle(profile.vehicle);
        setPage("home");
        showNotice(tr("profileSaved"));
        return;
      }

      const savedProfile = parseAccountProfile(
        (await AsyncStorage.getItem("sayarti.accountProfile")) ?? "",
      );
      if (savedProfile) {
        setVehicle(savedProfile.vehicle);
        setSignupVehicle(savedProfile.vehicle);
        setPage("home");
      } else {
        setVehicle({ brand: "", model: "", year: "", fuel: "diesel", mileage: "" });
        setPage("vehicle");
      }
      showNotice(tr("signedInAs"));
    } catch (error) {
      setRegistrationError(tr(emailAuthErrorKey(error)));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    await logoutEmailSession();
    setIsAuthenticated(false);
    setAuthStep("details");
    setVerificationCode("");
    setRegistrationError("");
    setPage("welcome");
    showNotice(tr("signOutNotice"));
  };

  const openForm = (kind: RecordKind) => {
    setInvoiceAttached(false);
    setEditingTarget(null);
    setDraft({
      ...emptyDraft,
      date: kind === "document" || kind === "servicePlan" ? "" : todayAsDmy(),
      title:
        kind === "maintenance" || kind === "servicePlan"
          ? tr("oilChange")
          : kind === "fuel"
            ? tr("fuel")
            : "",
      detail: kind === "document" ? "valid" : "",
    });
    setFormKind(kind);
  };

  const beginEdit = (kind: RecordKind, recordId: string) => {
    setInvoiceAttached(false);
    setEditingTarget({ kind, recordId });
    if (kind === "maintenance") {
      const item = maintenanceRecords.find((record) => record.id === recordId);
      if (!item) return;
      setDraft({
        ...emptyDraft,
        title: item.title,
        date: item.date,
        mileage: item.mileage.replace(/[^0-9]/g, ""),
        amount: String(item.cost),
        detail: item.note ?? "",
      });
    } else if (kind === "expense") {
      const item = expenses.find((record) => record.id === recordId);
      if (!item) return;
      setDraft({
        ...emptyDraft,
        title: item.title,
        date: item.date,
        amount: String(item.amount),
        category: categoryKeyFor(item.category),
      });
    } else if (kind === "fuel") {
      const item = fuelRecords.find((record) => record.id === recordId);
      if (!item) return;
      setDraft({
        ...emptyDraft,
        title: tr("fuel"),
        date: item.date,
        mileage: String(item.mileage),
        amount: String(item.amount),
        liters: String(item.liters),
        price: String(item.pricePerLiter),
      });
    } else if (kind === "document") {
      const item = documentsList.find((record) => record.id === recordId);
      if (!item) return;
      setDraft({
        ...emptyDraft,
        title: item.title,
        date: item.expiry,
        detail: item.status,
      });
    } else {
      const item = servicePlans.find((record) => record.id === recordId);
      if (!item) return;
      setDraft({
        ...emptyDraft,
        title: item.title,
        mileage: String(item.remainingKm),
      });
    }
    setFormKind(kind);
  };

  const cancelNativeReminder = async (reminder?: ScheduledReminder) => {
    if (Platform.OS === "web" || !reminder?.notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    } catch {
      // The operating system may already have delivered or removed this notification.
    }
  };

  const saveScheduledReminder = async (
    target: RecordTarget,
    scheduledAt: string,
    soundId: ReminderSoundId,
    requestPermission: boolean,
  ) => {
    const key = makeReminderKey(target.kind, target.recordId);
    const previous = reminders.find((item) => item.key === key);
    await cancelNativeReminder(previous);
    let permissionGranted = false;
    let notificationId: string | undefined;
    const soundFile = reminderSoundFiles[soundId];

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && "Notification" in window) {
        let permission = window.Notification.permission;
        if (permission !== "granted" && requestPermission && permission === "default") {
          permission = await window.Notification.requestPermission();
        }
        permissionGranted = permission === "granted";
      }
    } else {
      try {
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && requestPermission) {
          permission = await Notifications.requestPermissionsAsync();
        }
        permissionGranted = permission.granted;
        if (permissionGranted) {
          const channelId = `sayarti-reminders-${soundId}`;
          if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync(channelId, {
              name: `${tr("reminders")} · ${tr(reminderSoundTranslationKeys[soundId])}`,
              importance: Notifications.AndroidImportance.HIGH,
              sound: soundFile,
              vibrationPattern:
                soundId === "alarm" ? [0, 250, 150, 250, 150, 500] : [0, 250],
            });
          }
          notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: tr("reminderNotificationTitle"),
              body: `${tr("reminderNotificationBody")} · ${target.title}`,
              data: { kind: target.kind, recordId: target.recordId, soundId },
              sound: soundFile,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(scheduledAt),
              ...(Platform.OS === "android" ? { channelId } : {}),
            },
          });
        }
      } catch {
        permissionGranted = false;
      }
    }

    setReminders((current) => [
      ...current.filter((item) => item.key !== key),
      {
        key,
        kind: target.kind,
        recordId: target.recordId,
        title: target.title,
        scheduledAt,
        soundId,
        notificationId,
      },
    ]);
    return permissionGranted;
  };

  const openSchedule = (kind: RecordKind, recordId: string, title: string) => {
    const key = makeReminderKey(kind, recordId);
    const existing = reminders.find((item) => item.key === key);
    const existingDate = existing ? new Date(existing.scheduledAt) : null;
    setReminderDateTime(
      existingDate && existingDate.getTime() > Date.now()
        ? existingDate
        : suggestedReminderDateTime(),
    );
    setSelectedReminderSound(existing?.soundId ?? "default");
    setScheduleInputValid(true);
    setScheduleError("");
    setScheduleOpenId((value) => value + 1);
    setScheduleTarget({ kind, recordId, title });
  };

  const saveSelectedReminder = async () => {
    if (!scheduleTarget) return;
    if (!scheduleInputValid || reminderDateTime.getTime() <= Date.now()) {
      setScheduleError(tr("invalidReminderTime"));
      return;
    }
    let permissionGranted = false;
    try {
      permissionGranted = await saveScheduledReminder(
        scheduleTarget,
        reminderDateTime.toISOString(),
        selectedReminderSound,
        true,
      );
    } catch {
      permissionGranted = false;
    }
    setScheduleTarget(null);
    setScheduleError("");
    showNotice(
      permissionGranted ? tr("reminderSaved") : tr("reminderSavedInApp"),
    );
  };

  const clearReminder = async (target: RecordTarget) => {
    const key = makeReminderKey(target.kind, target.recordId);
    const reminder = reminders.find((item) => item.key === key);
    await cancelNativeReminder(reminder);
    setReminders((current) => current.filter((item) => item.key !== key));
    setScheduleTarget(null);
    showNotice(tr("reminderCancelled"));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const snapshot = removeSnapshotRecord(
      { maintenanceRecords, expenses, fuelRecords, documentsList, servicePlans, reminders },
      target.kind,
      target.recordId,
    );
    await cancelNativeReminder(
      reminders.find((item) => item.key === makeReminderKey(target.kind, target.recordId)),
    );
    setMaintenanceRecords(snapshot.maintenanceRecords);
    setExpenses(snapshot.expenses);
    setFuelRecords(snapshot.fuelRecords);
    setDocumentsList(snapshot.documentsList);
    setServicePlans(snapshot.servicePlans);
    setReminders(snapshot.reminders);
    setDeleteTarget(null);
    showNotice(tr("deletedToast"));
  };

  const saveForm = () => {
    if (!formKind) return;
    const editing = editingTarget?.kind === formKind ? editingTarget : null;
    const recordId = editing?.recordId ?? makeRecordId(formKind);
    const amount = Number(draft.amount.replace(/[^0-9.]/g, "")) || 0;
    const title =
      draft.title.trim() ||
      (formKind === "maintenance" || formKind === "servicePlan"
        ? tr("oilChange")
        : formKind === "fuel"
          ? tr("fuel")
          : formKind === "document"
            ? tr("documentType")
            : tr("otherCategory"));

    if (formKind === "maintenance") {
      const item: MaintenanceItem = {
        id: recordId,
        title,
        mileage: `${draft.mileage || vehicle.mileage} km`,
        date: draft.date,
        cost: amount,
        note: invoiceAttached
          ? `${draft.detail}${draft.detail ? " · " : ""}${tr("invoiceAdded")}`
          : draft.detail,
      };
      setMaintenanceRecords((current) =>
        editing
          ? current.map((record) => (record.id === recordId ? item : record))
          : [item, ...current],
      );
      setExpenses((current) =>
        editing
          ? current.map((expense) =>
              expense.linkedKind === "maintenance" && expense.linkedId === recordId
                ? { ...expense, title, amount, date: draft.date }
                : expense,
            )
          : [
              {
                id: makeRecordId("expense"),
                title,
                category: tr("serviceCategory"),
                amount,
                date: draft.date,
                linkedKind: "maintenance",
                linkedId: recordId,
              },
              ...current,
            ],
      );
    } else if (formKind === "servicePlan") {
      const item: ServicePlanItem = {
        id: recordId,
        title,
        remainingKm: Number(draft.mileage) || 0,
      };
      setServicePlans((current) =>
        editing
          ? current.map((record) => (record.id === recordId ? item : record))
          : [item, ...current],
      );
    } else if (formKind === "expense") {
      const previousExpense = editing
        ? expenses.find((record) => record.id === recordId)
        : undefined;
      const item: ExpenseItem = {
        ...(previousExpense ?? {}),
        id: recordId,
        title,
        category: tr(draft.category as TranslationKey),
        amount,
        date: draft.date,
      };
      if (previousExpense?.linkedKind === "maintenance" && previousExpense.linkedId) {
        setMaintenanceRecords((current) =>
          current.map((record) =>
            record.id === previousExpense.linkedId
              ? { ...record, title, cost: amount, date: draft.date }
              : record,
          ),
        );
      } else if (previousExpense?.linkedKind === "fuel" && previousExpense.linkedId) {
        setFuelRecords((current) =>
          current.map((record) =>
            record.id === previousExpense.linkedId
              ? { ...record, amount, date: draft.date }
              : record,
          ),
        );
      }
      setExpenses((current) =>
        editing
          ? current.map((record) => (record.id === recordId ? item : record))
          : [item, ...current],
      );
    } else if (formKind === "fuel") {
      const item: FuelItem = {
        id: recordId,
        amount,
        liters: Number(draft.liters) || 0,
        pricePerLiter: Number(draft.price) || 0,
        mileage: Number(draft.mileage) || 0,
        date: draft.date,
      };
      setFuelRecords((current) =>
        editing
          ? current.map((record) => (record.id === recordId ? item : record))
          : [item, ...current],
      );
      setExpenses((current) =>
        editing
          ? current.map((expense) =>
              expense.linkedKind === "fuel" && expense.linkedId === recordId
                ? { ...expense, title: tr("fuel"), amount, date: draft.date }
                : expense,
            )
          : [
              {
                id: makeRecordId("expense"),
                title: tr("fuel"),
                category: tr("fuelCategory"),
                amount,
                date: draft.date,
                linkedKind: "fuel",
                linkedId: recordId,
              },
              ...current,
            ],
      );
    } else {
      const status: DocumentItem["status"] =
        draft.detail === "soon" || draft.detail === "stored"
          ? draft.detail
          : "valid";
      const item: DocumentItem = {
        id: recordId,
        title,
        expiry: draft.date,
        status,
      };
      setDocumentsList((current) =>
        editing
          ? current.map((record) => (record.id === recordId ? item : record))
          : [item, ...current],
      );
    }

    const existingReminder = reminders.find(
      (item) => item.key === makeReminderKey(formKind, recordId),
    );
    if (editing && existingReminder) {
      void saveScheduledReminder(
        { kind: formKind, recordId, title },
        existingReminder.scheduledAt,
        existingReminder.soundId ?? "default",
        false,
      );
    }
    setFormKind(null);
    setEditingTarget(null);
    showNotice(editing ? tr("updatedToast") : tr("savedToast"));
  };

  const openProfile = async () => {
    const value = profileLink.trim();
    if (!value) return showNotice(tr("emptyProfile"));
    if (!/^https?:\/\//i.test(value))
      return showNotice(tr("profileUnavailable"));
    try {
      await Linking.openURL(value);
    } catch {
      showNotice(tr("profileUnavailable"));
    }
  };

  const field = (
    key: keyof Draft,
    label: TranslationKey,
    placeholder = "",
    numeric = false,
  ) => (
    <View style={{ gap: 8, marginBottom: 14 }} key={key}>
      <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
        {tr(label)}
      </Text>
      <TextInput
        value={draft[key]}
        onChangeText={(value) =>
          setDraft((current) => ({ ...current, [key]: value }))
        }
        placeholder={placeholder || tr("fillTitle")}
        placeholderTextColor={c.muted}
        keyboardType={numeric ? "decimal-pad" : "default"}
        textAlign={isRTL && !numeric ? "right" : "left"}
        style={[
          styles.input,
          {
            backgroundColor: c.bg,
            color: c.ink,
            borderColor: c.line,
            writingDirection: isRTL && !numeric ? "rtl" : "ltr",
          },
        ]}
      />
    </View>
  );

  const startTab = (next: TabPage) => setPage(next);
  const tabItems: { id: TabPage; key: TranslationKey; icon: IoniconName }[] = [
    { id: "home", key: "home", icon: "home-outline" },
    { id: "maintenance", key: "maintenance", icon: "construct-outline" },
    { id: "expenses", key: "expenses", icon: "wallet-outline" },
    { id: "documents", key: "documents", icon: "document-text-outline" },
    { id: "settings", key: "settings", icon: "settings-outline" },
  ];

  const Header = ({ title, eyebrow }: { title: string; eyebrow?: string }) => (
    <View
      style={[
        styles.header,
        { flexDirection: direction, borderBottomColor: c.line },
      ]}
    >
      <View style={[styles.brandRow, { flexDirection: direction }]}>
        <BrandMark size={42} />
        <View style={{ gap: 1 }}>
          <Text style={[styles.brandName, { color: c.ink }, textDirection]}>
            {tr("brand")}
          </Text>
          <Text style={[styles.eyebrow, { color: c.muted }, textDirection]}>
            {eyebrow ?? title}
          </Text>
        </View>
      </View>
      <View style={[styles.headerActions, { flexDirection: direction }]}>
        <Pressable
          onPress={() => setPage("login")}
          style={[
            styles.roundButton,
            { backgroundColor: c.surface, borderColor: c.line },
          ]}
          accessibilityRole="button"
          accessibilityLabel={tr("account")}
        >
          <Ionicons name="person-outline" size={19} color={c.ink} />
        </Pressable>
        <Pressable
          onPress={() => startTab("documents")}
          style={[
            styles.roundButton,
            { backgroundColor: c.surface, borderColor: c.line },
          ]}
          accessibilityRole="button"
          accessibilityLabel={tr("notifications")}
        >
          <Ionicons name="notifications-outline" size={19} color={c.ink} />
          {reminders.length > 0 ? (
            <View
              style={[styles.notificationDot, { backgroundColor: c.orange }]}
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );

  const SectionTitle = ({
    title,
    action,
    onPress,
  }: {
    title: string;
    action?: string;
    onPress?: () => void;
  }) => (
    <View style={[styles.sectionHeading, { flexDirection: direction }]}>
      <Text style={[styles.sectionTitle, { color: c.ink }, textDirection]}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onPress}>
          <Text style={[styles.actionText, { color: c.green }, textDirection]}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const PrimaryButton = ({
    label,
    onPress,
    icon = "add-outline" as IoniconName,
  }: {
    label: string;
    onPress: () => void;
    icon?: IoniconName;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: c.dark,
          opacity: pressed ? 0.86 : 1,
          flexDirection: direction,
        },
      ]}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );

  const InfoTile = ({
    icon,
    title,
    value,
    tint,
    bg,
    onPress,
  }: {
    icon: IoniconName;
    title: string;
    value: string;
    tint: string;
    bg: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoCard,
        {
          backgroundColor: c.surface,
          borderColor: c.line,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.infoIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text
        style={[styles.infoTitle, { color: c.muted }, textDirection]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[styles.infoValue, { color: c.ink }, textDirection]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </Pressable>
  );

  const RecordActions = ({ kind, recordId, title }: RecordTarget) => (
    <View
      style={[
        styles.recordActions,
        { flexDirection: direction, borderColor: c.line },
      ]}
    >
      {[
        {
          label: "editRecord" as TranslationKey,
          icon: "create-outline" as IoniconName,
          tint: c.green,
          action: () => beginEdit(kind, recordId),
        },
        {
          label: "scheduleReminder" as TranslationKey,
          icon: "alarm-outline" as IoniconName,
          tint: c.blue,
          action: () => openSchedule(kind, recordId, title),
        },
        {
          label: "deleteRecord" as TranslationKey,
          icon: "trash-outline" as IoniconName,
          tint: "#D65345",
          action: () => setDeleteTarget({ kind, recordId, title }),
        },
      ].map((item) => (
        <Pressable
          key={item.label}
          accessibilityRole="button"
          accessibilityLabel={tr(item.label)}
          onPress={item.action}
          style={({ pressed }) => [
            styles.recordActionButton,
            {
              flexDirection: direction,
              backgroundColor: c.surface,
              borderColor: c.line,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Ionicons name={item.icon} size={15} color={item.tint} />
          <Text style={[styles.recordActionText, { color: item.tint }]} numberOfLines={1}>
            {tr(item.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const ServiceRow = ({
    item,
    icon,
    tint,
    bg,
  }: {
    item: ServicePlanItem;
    icon: IoniconName;
    tint: string;
    bg: string;
  }) => (
    <View style={{ marginBottom: 10 }}>
      <View
        style={[
          styles.serviceRow,
          {
            flexDirection: direction,
            backgroundColor: c.surface,
            borderColor: c.line,
          },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
            {localizeDemoLabel(item.title)}
          </Text>
          <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
            {tr("inDistance")} {item.remainingKm.toLocaleString()} {tr("km")}
          </Text>
        </View>
      </View>
      <RecordActions kind="servicePlan" recordId={item.id} title={localizeDemoLabel(item.title)} />
    </View>
  );

  const DocumentRow = ({
    item,
    rowKey,
  }: {
    item: DocumentItem;
    rowKey?: string;
  }) => {
    const iconName: IoniconName =
      item.title.toLowerCase().includes("insurance") ||
      item.title.includes("التأمين") ||
      item.title.includes("Assurance")
        ? "shield-checkmark-outline"
        : item.title.toLowerCase().includes("technical") ||
            item.title.includes("المراقبة") ||
            item.title.includes("Contrôle")
          ? "car-sport-outline"
          : "document-text-outline";
    const statusText =
      item.status === "soon"
        ? tr("dueSoon")
        : item.status === "stored"
          ? tr("stored")
          : tr("valid");
    const tint = item.status === "soon" ? c.orange : c.green;
    const soft = item.status === "soon" ? c.orangeSoft : c.greenSoft;
    return (
      <View key={rowKey} style={{ marginBottom: 10 }}>
        <View
          style={[
            styles.documentRow,
            {
              flexDirection: direction,
              backgroundColor: c.surface,
              borderColor: c.line,
            },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: soft }]}>
            <Ionicons name={iconName} size={20} color={tint} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
              {localizeDemoLabel(item.title)}
            </Text>
            <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
              {item.expiry === "—"
                ? statusText
                : `${tr("expires")} ${item.expiry}`}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: soft }]}>
            <Text style={[styles.statusText, { color: tint }]}>{statusText}</Text>
          </View>
        </View>
        <RecordActions kind="document" recordId={item.id} title={localizeDemoLabel(item.title)} />
      </View>
    );
  };

  const ExpenseRow = ({
    item,
    rowKey,
  }: {
    item: ExpenseItem;
    rowKey?: string;
  }) => {
    const iconName: IoniconName =
      item.category.toLowerCase().includes("fuel") ||
      item.category.includes("الوقود") ||
      item.category.includes("Carburant")
        ? "flash-outline"
        : item.category.toLowerCase().includes("service") ||
            item.category.includes("الصيانة") ||
            item.category.includes("Entretien")
          ? "construct-outline"
          : "cube-outline";
    return (
      <View key={rowKey} style={{ borderBottomColor: c.line, borderBottomWidth: 1, paddingVertical: 10 }}>
        <View style={[styles.expenseRow, { flexDirection: direction, borderBottomColor: "transparent" }]}>
          <View style={[styles.rowIcon, { backgroundColor: c.surfaceSoft }]}>
            <Ionicons name={iconName} size={19} color={c.ink} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
              {localizeDemoLabel(item.title)}
            </Text>
            <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
              {item.date} · {localizeDemoLabel(item.category)}
            </Text>
          </View>
          <Text style={[styles.moneySmall, { color: c.ink }, textDirection]}>
            {money(item.amount)}
          </Text>
        </View>
        <RecordActions
          kind="expense"
          recordId={item.id}
          title={localizeDemoLabel(item.title)}
        />
      </View>
    );
  };

  const FuelRow = ({ item, rowKey }: { item: FuelItem; rowKey: string }) => (
    <View
      key={rowKey}
      style={{
        paddingVertical: 10,
        borderBottomColor: c.line,
        borderBottomWidth: 1,
      }}
    >
      <View style={[styles.expenseRow, { flexDirection: direction, borderBottomColor: "transparent" }]}>
        <View style={[styles.rowIcon, { backgroundColor: c.blueSoft }]}>
          <Ionicons name="flash-outline" size={19} color={c.blue} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
            {tr("fuel")} · {item.liters} L
          </Text>
          <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
            {item.date} · {item.pricePerLiter.toFixed(2)} {tr("priceShort")}/L · {item.mileage.toLocaleString()} {tr("km")}
          </Text>
        </View>
        <Text style={[styles.moneySmall, { color: c.ink }, textDirection]}>
          {money(item.amount)}
        </Text>
      </View>
      <RecordActions kind="fuel" recordId={item.id} title={tr("fuel")} />
    </View>
  );

  const QuickAction = ({
    icon,
    label,
    tint,
    onPress,
  }: {
    icon: IoniconName;
    label: string;
    tint: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: c.surface,
          borderColor: c.line,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={21} color={tint} />
      </View>
      <Text
        style={[styles.quickText, { color: c.ink }, textDirection]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  const HomeContent = () => (
    <>
      <View style={[styles.welcomeLine, { flexDirection: direction }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.greeting, { color: c.ink }, textDirection]}>
            {firstName ? `${tr("greeting")} ${firstName}` : tr("greeting")} 👋
          </Text>
          <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
            {tr("subtitle")}
          </Text>
        </View>
        <View style={[styles.demoBadge, { backgroundColor: c.greenSoft }]}>
          <View style={[styles.liveDot, { backgroundColor: c.green }]} />
          <Text style={[styles.demoBadgeText, { color: c.ink }]}>
            {tr("demoTag")}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => setPage("vehicle")}
        style={({ pressed }) => [
          styles.vehicleCard,
          {
            backgroundColor: c.dark,
            flexDirection: direction,
            opacity: pressed ? 0.94 : 1,
          },
        ]}
      >
        <View style={styles.carOrb}>
          <Ionicons name="car-sport" size={41} color="#E6F8F1" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.carTopline, { flexDirection: direction }]}>
            <Text style={styles.carMake}>
              {vehicle.brand} {vehicle.model}
            </Text>
            <View style={styles.carTag}>
              <Text style={styles.carTagText}>{vehicle.year}</Text>
            </View>
          </View>
          <Text style={styles.carMeta}>
            {vehicle.fuel === "diesel"
              ? tr("diesel")
              : vehicle.fuel === "petrol"
                ? tr("petrol")
                : tr("lpg")}{" "}
            · {Number(vehicle.mileage).toLocaleString(numberLocale)} {tr("km")}
          </Text>
          <View style={styles.odometerTrack}>
            <View style={styles.odometerFill} />
          </View>
          <Text style={styles.odometerHint}>
            {tr("currentCar")} · {tr("editVehicle")}
          </Text>
        </View>
        <Ionicons
          name={isRTL ? "chevron-back" : "chevron-forward"}
          size={20}
          color="#9CD9C4"
        />
      </Pressable>

      <Pressable
        onPress={() => startTab("maintenance")}
        style={({ pressed }) => [
          styles.alertCard,
          {
            flexDirection: direction,
            backgroundColor: c.orangeSoft,
            borderColor: `${c.orange}52`,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={[styles.alertIcon, { backgroundColor: c.orange }]}>
          <Ionicons name="construct" size={21} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.alertTitle, { color: c.ink }, textDirection]}>
            {tr("upcoming")}
          </Text>
          <Text style={[styles.alertValue, { color: c.ink }, textDirection]}>
            {tr("oilChange")}
          </Text>
          <Text style={[styles.alertSub, { color: c.muted }, textDirection]}>
            {tr("inDistance")} 1,200 {tr("km")}
          </Text>
        </View>
        <View style={styles.alertChevron}>
          <Ionicons
            name={isRTL ? "chevron-back" : "chevron-forward"}
            size={18}
            color={c.ink}
          />
        </View>
      </Pressable>

      <View style={[styles.statRow, { flexDirection: direction }]}>
        {InfoTile({
          icon: "wallet-outline",
          title: tr("monthlySpend"),
          value: money(monthlyTotal),
          tint: c.green,
          bg: c.greenSoft,
          onPress: () => startTab("expenses"),
        })}
        {InfoTile({
          icon: "speedometer-outline",
          title: tr("lastFuel"),
          value: money(fuelEntry.amount),
          tint: c.blue,
          bg: c.blueSoft,
          onPress: () => openForm("fuel"),
        })}
      </View>

      {SectionTitle({ title: tr("quickActions") })}
      <View style={[styles.quickRow, { flexDirection: direction }]}>
        {QuickAction({
          icon: "construct-outline",
          label: tr("addMaintenance"),
          tint: c.green,
          onPress: () => openForm("maintenance"),
        })}
        {QuickAction({
          icon: "wallet-outline",
          label: tr("addExpense"),
          tint: c.blue,
          onPress: () => openForm("expense"),
        })}
        {QuickAction({
          icon: "flash-outline",
          label: tr("addFuel"),
          tint: c.orange,
          onPress: () => openForm("fuel"),
        })}
        {QuickAction({
          icon: "document-text-outline",
          label: tr("addDocument"),
          tint: c.purple,
          onPress: () => openForm("document"),
        })}
      </View>

      {SectionTitle({
        title: tr("reminders"),
        action: tr("seeAll"),
        onPress: () => startTab("documents"),
      })}
      <View
        style={[
          styles.reminderCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <View style={[styles.reminderRow, { flexDirection: direction }]}>
          <View style={[styles.miniIcon, { backgroundColor: c.orangeSoft }]}>
            <Ionicons name="time-outline" size={17} color={c.orange} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
              {tr("serviceDue")}
            </Text>
            <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
              {tr("seeReminder")}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: c.orangeSoft }]}>
            <Text style={[styles.statusText, { color: c.orange }]}>
              {tr("upcoming")}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.reminderRow,
            { flexDirection: direction, borderTopColor: c.line },
          ]}
        >
          <View style={[styles.miniIcon, { backgroundColor: c.redSoft }]}>
            <Ionicons name="shield-checkmark-outline" size={17} color={c.red} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
              {tr("insurance")}
            </Text>
            <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
              {insuranceDaysLabel}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: c.redSoft }]}>
            <Text style={[styles.statusText, { color: c.red }]}>
              {tr("dueSoon")}
            </Text>
          </View>
        </View>
      </View>

      {SectionTitle({
        title: tr("annualStats"),
        action: tr("seeAll"),
        onPress: () => startTab("expenses"),
      })}
      <View
        style={[
          styles.yearCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <View style={[styles.yearHead, { flexDirection: direction }]}>
          <View style={{ gap: 2 }}>
            <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
              {tr("annualSpend")}
            </Text>
            <Text style={[styles.yearTotal, { color: c.ink }, textDirection]}>
              {money(annualTotal)}
            </Text>
          </View>
          <View style={[styles.roundIcon, { backgroundColor: c.greenSoft }]}>
            <Ionicons name="stats-chart-outline" size={20} color={c.green} />
          </View>
        </View>
        <View style={styles.barTrack}>
          {annualCategoryBreakdown.map((item) => (
            <View
              key={item.key}
              style={[
                styles.barFill,
                {
                  width: `${annualTotal > 0 ? (item.amount / annualTotal) * 100 : 0}%`,
                  backgroundColor: item.tint,
                },
              ]}
            />
          ))}
        </View>
        <View style={[styles.legendRow, { flexDirection: direction }]}>
          {annualCategoryBreakdown.map((item) => (
            <Text
              key={item.key}
              style={[styles.legendText, { color: c.muted }, textDirection]}
            >
              {tr(item.key)} {money(item.amount)}
            </Text>
          ))}
        </View>
        <View
          style={[
            styles.perKmRow,
            { flexDirection: direction, borderTopColor: c.line },
          ]}
        >
          <Text style={[styles.legendText, { color: c.muted }, textDirection]}>
            {tr("perKm")}
          </Text>
          <Text style={[styles.perKmValue, { color: c.ink }]}>
            18.4 {tr("priceShort")} / {tr("km")}
          </Text>
        </View>
      </View>
    </>
  );

  const MaintenanceContent = () => (
    <>
      <View style={[styles.pageIntro, { flexDirection: direction }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.pageTitle, { color: c.ink }, textDirection]}>
            {tr("maintenance")}
          </Text>
          <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
            {tr("vehicle")} · {vehicle.brand} {vehicle.model}
          </Text>
        </View>
        <View style={[styles.roundIcon, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="construct-outline" size={23} color={c.green} />
        </View>
      </View>
      <View
        style={[
          styles.lastServiceCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <View style={[styles.lastServiceHead, { flexDirection: direction }]}>
          <View style={[styles.rowIcon, { backgroundColor: c.greenSoft }]}>
            <Ionicons name="checkmark-circle" size={22} color={c.green} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.rowSub, { color: c.green }, textDirection]}>
              {tr("lastService")}
            </Text>
            <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
              {maintenanceRecords[0]
                ? localizeDemoLabel(maintenanceRecords[0].title)
                : tr("oilChange")}
            </Text>
          </View>
          <Text style={[styles.moneySmall, { color: c.green }, textDirection]}>
            {money(maintenanceRecords[0]?.cost ?? 6500)}
          </Text>
        </View>
        <View style={[styles.lastServiceMeta, { flexDirection: direction }]}>
          <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
            {maintenanceRecords[0]?.date ?? "08/10/2026"}
          </Text>
          <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
            {maintenanceRecords[0]?.mileage ?? "185,200 km"}
          </Text>
        </View>
        {maintenanceRecords[0] ? (
          <RecordActions
            kind="maintenance"
            recordId={maintenanceRecords[0].id}
            title={localizeDemoLabel(maintenanceRecords[0].title)}
          />
        ) : null}
      </View>
      {SectionTitle({ title: tr("upcoming") })}
      {servicePlans.map((item, index) => {
        const visuals = [
          { icon: "water-outline" as IoniconName, tint: c.orange, bg: c.orangeSoft },
          { icon: "options-outline" as IoniconName, tint: c.blue, bg: c.blueSoft },
          { icon: "disc-outline" as IoniconName, tint: c.purple, bg: c.surfaceSoft },
        ][index % 3]!;
        return ServiceRow({ item, ...visuals });
      })}
      {PrimaryButton({
        label: tr("addServicePlan"),
        onPress: () => openForm("servicePlan"),
      })}
      {SectionTitle({ title: tr("allServices") })}
      <View
        style={[
          styles.listCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        {maintenanceRecords.map((item, index) =>
          ExpenseRow({
            rowKey: item.id || `${item.title}-${index}`,
            item: {
              id: item.id,
              title: item.title,
              category: tr("serviceCategory"),
              amount: item.cost,
              date: item.date,
              linkedKind: "maintenance",
              linkedId: item.id,
            },
          }),
        )}
      </View>
      {PrimaryButton({
        label: tr("addMaintenance"),
        onPress: () => openForm("maintenance"),
      })}
    </>
  );

  const ExpensesContent = () => (
    <>
      <View style={[styles.pageIntro, { flexDirection: direction }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.pageTitle, { color: c.ink }, textDirection]}>
            {tr("expenses")}
          </Text>
          <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
            {tr("monthly")}, {calendarNow.toLocaleDateString(numberLocale, { month: "long", year: "numeric" })}
          </Text>
        </View>
        <View style={[styles.roundIcon, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="wallet-outline" size={23} color={c.green} />
        </View>
      </View>
      <View style={[styles.expenseHero, { backgroundColor: c.dark }]}>
        <Text style={[styles.heroLabel, textDirection]}>
          {tr("monthlySpend")}
        </Text>
        <Text style={[styles.heroAmount, textDirection]}>
          {money(monthlyTotal)}
        </Text>
        <View style={[styles.heroMeta, { flexDirection: direction }]}>
          <Text style={styles.heroMetaText}>{tr("yearlyTotal")}</Text>
          <Text style={styles.heroMetaText}>{money(annualTotal)}</Text>
        </View>
      </View>
      {SectionTitle({ title: tr("category") })}
      {monthlyCategoryBreakdown.map((item) => (
        <View
          key={item.key}
          style={[
            styles.categoryRow,
            {
              flexDirection: direction,
              backgroundColor: c.surface,
              borderColor: c.line,
            },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: c.surfaceSoft }]}>
            <Ionicons name={item.icon} size={19} color={item.tint} />
          </View>
          <Text
            style={[styles.rowTitle, { color: c.ink, flex: 1 }, textDirection]}
          >
            {tr(item.key)}
          </Text>
          <View
            style={{
              width: 76,
              height: 6,
              backgroundColor: c.surfaceSoft,
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${monthlyTotal > 0 ? Math.min(100, Math.round((item.amount / monthlyTotal) * 100)) : 0}%`,
                height: 6,
                backgroundColor: item.tint,
                borderRadius: 9,
              }}
            />
          </View>
          <Text style={[styles.moneySmall, { color: c.ink }, textDirection]}>
            {money(item.amount)}
          </Text>
        </View>
      ))}
      {SectionTitle({ title: tr("serviceHistory") })}
      <View
        style={[
          styles.listCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        {expenses.map((item, index) =>
          ExpenseRow({
            rowKey: item.id || `${item.title}-${item.date}-${index}`,
            item: item,
          }),
        )}
      </View>
      {SectionTitle({ title: tr("fuel") })}
      <View
        style={[
          styles.listCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        {fuelRecords.map((item, index) =>
          FuelRow({ item, rowKey: item.id || `fuel-${index}` }),
        )}
      </View>
      {PrimaryButton({
        label: tr("addFuelRecord"),
        onPress: () => openForm("fuel"),
      })}
      {PrimaryButton({
        label: tr("addExpense"),
        onPress: () => openForm("expense"),
      })}
    </>
  );

  const DocumentsContent = () => (
    <>
      <View style={[styles.pageIntro, { flexDirection: direction }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.pageTitle, { color: c.ink }, textDirection]}>
            {tr("documents")}
          </Text>
          <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
            {tr("reminders")} · {documentsList.length}
          </Text>
        </View>
        <View style={[styles.roundIcon, { backgroundColor: c.blueSoft }]}>
          <Ionicons name="document-text-outline" size={23} color={c.blue} />
        </View>
      </View>
      <View
        style={[
          styles.documentAlert,
          {
            flexDirection: direction,
            backgroundColor: c.orangeSoft,
            borderColor: `${c.orange}48`,
          },
        ]}
      >
        <Ionicons name="alert-circle" size={21} color={c.orange} />
        <Text
          style={[
            styles.documentAlertText,
            { color: c.ink, flex: 1 },
            textDirection,
          ]}
        >
          {tr("insurance")} · {insuranceDaysLabel}
        </Text>
      </View>
      {SectionTitle({ title: tr("vehicle") })}
      {documentsList.map((item, index) =>
        DocumentRow({ item: item, rowKey: item.id || `${item.title}-${index}` }),
      )}
      {SectionTitle({ title: tr("scheduledReminders") })}
      <View
        style={[
          styles.listCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        {reminders.length === 0 ? (
          <Text style={[styles.bodyText, { color: c.muted, padding: 14 }, textDirection]}>
            {tr("noScheduledReminders")}
          </Text>
        ) : (
          reminders.map((item) => (
            <View
              key={item.key}
              style={[
                styles.scheduledReminderRow,
                { flexDirection: direction, borderBottomColor: c.line },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
                  {item.title}
                </Text>
                <Text style={[styles.rowSub, { color: item.triggeredAt ? c.orange : c.muted }, textDirection]}>
                  {item.triggeredAt
                    ? tr("reminderDueNow")
                    : new Date(item.scheduledAt).toLocaleString(
                        language === "ar" ? "ar-DZ" : language === "fr" ? "fr-DZ" : "en-DZ",
                        { dateStyle: "medium", timeStyle: "short" },
                      )} · {tr(reminderSoundTranslationKeys[item.soundId ?? "default"])}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr("removeReminder")}
                onPress={() =>
                  clearReminder({
                    kind: item.kind,
                    recordId: item.recordId,
                    title: item.title,
                  })
                }
                style={[styles.reminderCancelButton, { borderColor: c.line }]}
              >
                <Ionicons name="close-circle-outline" size={17} color="#D65345" />
                <Text style={[styles.reminderCancelText, { color: "#D65345" }]}>
                  {tr("removeReminder")}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
      <View style={[styles.noteCard, { backgroundColor: c.surfaceSoft }]}>
        <Ionicons name="lock-closed-outline" size={18} color={c.muted} />
        <Text style={[styles.noteText, { color: c.muted }, textDirection]}>
          {tr("scanLater")}
        </Text>
      </View>
      {PrimaryButton({
        label: tr("addDocument"),
        onPress: () => openForm("document"),
      })}
    </>
  );

  const SettingsContent = () => (
    <>
      <View style={[styles.pageIntro, { flexDirection: direction }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.pageTitle, { color: c.ink }, textDirection]}>
            {tr("settings")}
          </Text>
          <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
            {firstName && lastName ? `${firstName} ${lastName}` : tr("accountDemo")}
          </Text>
        </View>
        <View style={[styles.roundIcon, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="person-outline" size={23} color={c.green} />
        </View>
      </View>
      {SectionTitle({ title: tr("language") })}
      <View
        style={[
          styles.languageCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        {languages.map((item) => {
          const label =
            item === "ar"
              ? tr("languageAr")
              : item === "fr"
                ? tr("languageFr")
                : tr("languageEn");
          const selected = language === item;
          return (
            <Pressable
              key={item}
              onPress={() => setLanguage(item)}
              style={[
                styles.languageOption,
                {
                  backgroundColor: selected ? c.dark : c.bg,
                  borderColor: selected ? c.dark : c.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  { color: selected ? "#FFFFFF" : c.ink },
                ]}
              >
                {label}
              </Text>
              {selected ? (
                <Ionicons name="checkmark-circle" size={16} color="#74DDB8" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {SectionTitle({ title: tr("theme") })}
      <View
        style={[
          styles.settingRow,
          {
            flexDirection: direction,
            backgroundColor: c.surface,
            borderColor: c.line,
          },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: c.surfaceSoft }]}>
          <Ionicons
            name={darkMode ? "moon-outline" : "sunny-outline"}
            size={19}
            color={c.ink}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: c.ink }, textDirection]}>
            {tr("theme")}
          </Text>
          <Text style={[styles.rowSub, { color: c.muted }, textDirection]}>
            {darkMode ? tr("dark") : tr("light")}
          </Text>
        </View>
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
          trackColor={{ false: c.line, true: c.green }}
          thumbColor="#FFFFFF"
        />
      </View>
      {SectionTitle({ title: tr("profileLink") })}
      <View
        style={[
          styles.profileCard,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <Text style={[styles.profileHint, { color: c.muted }, textDirection]}>
          {profileLink ? tr("openProfile") : tr("profileUnavailable")}
        </Text>
        <TextInput
          value={profileLink}
          onChangeText={setProfileLink}
          placeholder={tr("profileHint")}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          keyboardType="url"
          textAlign="left"
          style={[
            styles.input,
            styles.urlInput,
            {
              color: c.ink,
              backgroundColor: c.bg,
              borderColor: c.line,
              writingDirection: "ltr",
            },
          ]}
        />
        <Pressable
          onPress={openProfile}
          style={[
            styles.openLinkButton,
            { flexDirection: direction, backgroundColor: c.surfaceSoft },
          ]}
        >
          <Ionicons name="link-outline" size={17} color={c.ink} />
          <Text style={[styles.openLinkText, { color: c.ink }]}>
            {tr("openProfile")}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => setPage("welcome")}
        style={[
          styles.settingRow,
          {
            flexDirection: direction,
            backgroundColor: c.surface,
            borderColor: c.line,
          },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="sparkles-outline" size={19} color={c.green} />
        </View>
        <Text
          style={[styles.rowTitle, { color: c.ink, flex: 1 }, textDirection]}
        >
          {tr("restartIntro")}
        </Text>
        <Ionicons
          name={isRTL ? "chevron-back" : "chevron-forward"}
          size={18}
          color={c.muted}
        />
      </Pressable>
      <View style={[styles.premiumCard, { backgroundColor: c.dark }]}>
        <View style={[styles.premiumTop, { flexDirection: direction }]}>
          <View style={[styles.premiumIcon, { backgroundColor: "#194F52" }]}>
            <Ionicons name="star" size={19} color="#8FE6C6" />
          </View>
          <Text style={styles.premiumLabel}>{tr("premium")}</Text>
          <View style={styles.premiumTag}>
            <Text style={styles.premiumTagText}>PRO</Text>
          </View>
        </View>
        <Text style={[styles.premiumTitle, textDirection]}>
          {tr("premiumTitle")}
        </Text>
        <Text style={[styles.premiumDesc, textDirection]}>
          {tr("premiumDesc")}
        </Text>
        <View style={[styles.premiumFooter, { flexDirection: direction }]}>
          <Text style={styles.premiumPrice}>{tr("premiumPrice")}</Text>
          <Text style={styles.previewOnly}>{tr("previewOnly")}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => {
          if (isAuthenticated) {
            void signOut();
          } else {
            setAuthStep("details");
            setRegistrationError("");
            setPage("login");
          }
        }}
        style={[
          styles.secondaryButton,
          { borderColor: c.line, flexDirection: direction },
        ]}
      >
        <Ionicons
          name={isAuthenticated ? "log-out-outline" : "log-in-outline"}
          size={18}
          color={c.ink}
        />
        <Text style={[styles.secondaryButtonText, { color: c.ink }]}>
          {tr(isAuthenticated ? "logout" : "demoLogin")}
        </Text>
      </Pressable>
    </>
  );

  const AuthContent = ({ register = false }: { register?: boolean }) => {
    const registrationField = (
      label: TranslationKey,
      value: string,
      onChangeText: (value: string) => void,
      keyboardType: "default" | "number-pad" = "default",
    ) => (
      <View style={{ gap: 8 }}>
        <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
          {tr(label)}
        </Text>
        <TextInput
          value={value}
          onChangeText={(nextValue) => {
            onChangeText(nextValue);
            if (registrationError) setRegistrationError("");
          }}
          placeholder={tr(label)}
          placeholderTextColor={c.muted}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "default" ? "words" : "none"}
          autoCorrect={false}
          returnKeyType="next"
          textAlign={isRTL && keyboardType === "default" ? "right" : "left"}
          style={[
            styles.input,
            {
              backgroundColor: c.surface,
              color: c.ink,
              borderColor: c.line,
            },
          ]}
        />
      </View>
    );
    const emailField = (
      <View style={{ gap: 8 }}>
        <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
          {tr("email")}
        </Text>
        <TextInput
          value={emailAddress}
          onChangeText={(value) => {
            setEmailAddress(value);
            if (registrationError) setRegistrationError("");
          }}
          placeholder="name@example.com"
          placeholderTextColor={c.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          textAlign="left"
          style={[
            styles.input,
            {
              backgroundColor: c.surface,
              color: c.ink,
              borderColor: c.line,
              writingDirection: "ltr",
            },
          ]}
        />
      </View>
    );
    const resendSeconds = resendCountdown;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.authScrollContent}
        >
          <View style={styles.authWrap}>
            <Pressable
              onPress={() => {
                if (authStep === "code") {
                  setAuthStep("details");
                  setVerificationCode("");
                } else {
                  setPage(register || !isAuthenticated ? "welcome" : "home");
                }
              }}
              style={[styles.backButton, { flexDirection: direction }]}
            >
              <Ionicons
                name={isRTL ? "arrow-forward" : "arrow-back"}
                size={20}
                color={c.ink}
              />
              <Text style={[styles.backText, { color: c.ink }]}>
                {tr("back")}
              </Text>
            </Pressable>
            <View
              style={[
                styles.authBrand,
                {
                  backgroundColor: c.dark,
                  padding: 10,
                },
              ]}
            >
              <View style={styles.brandLogoPlate}>
                <Image
                  source={require("@/assets/images/sayarti-dz-logo.png")}
                  resizeMode="contain"
                  accessibilityLabel="شعار سيارتي DZ"
                  style={styles.brandLogoImage}
                />
              </View>
            </View>
            <Text style={[styles.authTitle, { color: c.ink }, textDirection]}>
              {register ? tr("createAccount") : tr("signIn")}
            </Text>
            <Text style={[styles.authNote, { color: c.muted }, textDirection]}>
              {register ? tr("signupNote") : tr("loginNote")}
            </Text>

            {authStep === "code" ? (
              <View style={{ gap: 14, marginTop: 24 }}>
                <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
                  {tr("codeSent")} {authEmail}
                </Text>
                <View style={{ gap: 8 }}>
                  <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
                    {tr("verificationCode")}
                  </Text>
                  <TextInput
                    value={verificationCode}
                    onChangeText={(value) => {
                      setVerificationCode(value.replace(/\D/g, "").slice(0, 6));
                      if (registrationError) setRegistrationError("");
                    }}
                    placeholder="000000"
                    placeholderTextColor={c.muted}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    textAlign="center"
                    style={[
                      styles.input,
                      {
                        backgroundColor: c.surface,
                        color: c.ink,
                        borderColor: c.line,
                        writingDirection: "ltr",
                        letterSpacing: 8,
                        fontSize: 20,
                        fontWeight: "800",
                      },
                    ]}
                  />
                </View>
                {registrationError ? (
                  <Text accessibilityRole="alert" style={[styles.formError, { color: c.red }, textDirection]}>
                    {registrationError}
                  </Text>
                ) : null}
                <Pressable
                  disabled={authBusy || resendSeconds > 0}
                  onPress={() => requestAuthCode(register)}
                  style={{ alignSelf: isRTL ? "flex-end" : "flex-start", paddingVertical: 4 }}
                >
                  <Text style={{ color: resendSeconds > 0 ? c.muted : c.green, fontWeight: "800" }}>
                    {resendSeconds > 0
                      ? `${tr("resendCountdown")} ${resendSeconds}${tr("seconds")}`
                      : tr("resendCode")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAuthStep("details");
                    setVerificationCode("");
                    setRegistrationError("");
                  }}
                  style={{ alignSelf: isRTL ? "flex-end" : "flex-start", paddingVertical: 4 }}
                >
                  <Text style={{ color: c.muted, fontWeight: "700" }}>{tr("changeEmail")}</Text>
                </Pressable>
              </View>
            ) : register ? (
              <View style={{ gap: 13, marginTop: 10 }}>
                <Text style={[styles.signupSectionTitle, { color: c.ink }, textDirection]}>
                  {tr("personalInformation")}
                </Text>
                {registrationField("firstName", signupFirstName, setSignupFirstName)}
                {registrationField("lastName", signupLastName, setSignupLastName)}
                {emailField}
                <Text style={[styles.signupSectionTitle, { color: c.ink, marginTop: 4 }, textDirection]}>
                  {tr("carDetails")}
                </Text>
                {registrationField("brandName", signupVehicle.brand, (brand) => setSignupVehicle((current) => ({ ...current, brand })))}
                {registrationField("model", signupVehicle.model, (model) => setSignupVehicle((current) => ({ ...current, model })))}
                {registrationField("year", signupVehicle.year, (year) => setSignupVehicle((current) => ({ ...current, year })), "number-pad")}
                <View style={{ gap: 8 }}>
                  <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>{tr("fuelType")}</Text>
                  <View style={[styles.fuelChipList, { flexDirection: direction }]}>
                    {vehicleFuelTypes.map((fuel) => {
                      const selected = signupVehicle.fuel === fuel;
                      return (
                        <Pressable
                          key={fuel}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => {
                            setSignupVehicle((current) => ({ ...current, fuel }));
                            setRegistrationError("");
                          }}
                          style={[styles.fuelChip, { backgroundColor: selected ? c.dark : c.surface, borderColor: selected ? c.dark : c.line }]}
                        >
                          <Text style={[styles.fuelChipText, { color: selected ? "#FFFFFF" : c.ink }]}>{tr(fuel)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {registrationField("mileage", signupVehicle.mileage, (mileage) => setSignupVehicle((current) => ({ ...current, mileage })), "number-pad")}
                {registrationError ? (
                  <Text accessibilityRole="alert" style={[styles.formError, { color: c.red }, textDirection]}>
                    {registrationError}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={{ gap: 14, marginTop: 24 }}>
                {emailField}
                {registrationError ? (
                  <Text accessibilityRole="alert" style={[styles.formError, { color: c.red }, textDirection]}>
                    {registrationError}
                  </Text>
                ) : null}
              </View>
            )}

            <Pressable
              disabled={authBusy || (authStep === "code" && verificationCode.length !== 6)}
              onPress={() =>
                authStep === "code"
                  ? submitVerification(register)
                  : requestAuthCode(register)
              }
              style={[styles.authButton, { backgroundColor: c.green, opacity: authBusy ? 0.6 : 1 }]}
            >
              <Text style={styles.authButtonText}>
                {authStep === "code" ? tr("verifyCode") : tr("sendCode")}
              </Text>
            </Pressable>
            {authStep === "details" ? (
              <Pressable
                onPress={() => {
                  setRegistrationError("");
                  setAuthStep("details");
                  setVerificationCode("");
                  setPage(register ? "login" : "register");
                }}
                style={styles.switchAuth}
              >
                <Text style={[styles.switchAuthText, { color: c.muted }, textDirection]}>
                  {register ? tr("signIn") : tr("noAccount")} {" "}
                  <Text style={{ color: c.green, fontWeight: "800" }}>
                    {register ? tr("signIn") : tr("createAccount")}
                  </Text>
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                setIsAuthenticated(false);
                setPage("home");
              }}
              style={styles.guestButton}
            >
              <Text style={[styles.guestText, { color: c.ink }]}>
                {tr("continueDemo")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const WelcomeContent = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.welcomeWrap}
    >
      <View style={[styles.welcomeHero, { backgroundColor: c.dark }]}>
        <View style={styles.welcomeGlow} />
        <View style={styles.brandLogoPlate}>
          <Image
            source={require("@/assets/images/sayarti-dz-logo.png")}
            resizeMode="contain"
            accessibilityLabel="شعار سيارتي DZ"
            style={styles.brandLogoImage}
          />
        </View>
        <Text style={[styles.welcomeTitle, textDirection]}>
          {tr("welcomeTitle")}
        </Text>
        <Text style={[styles.welcomeSubtitle, textDirection]}>
          {tr("welcomeSubtitle")}
        </Text>
        <View style={[styles.roadLine, { backgroundColor: c.gold }]} />
      </View>
      <View style={{ paddingHorizontal: 24, gap: 12, marginTop: 24 }}>
        {PrimaryButton({
          label: tr("createAccount"),
          onPress: () => setPage("register"),
          icon: "person-add-outline",
        })}
        <Pressable onPress={() => setPage("login")} style={styles.switchAuth}>
          <Text
            style={[styles.switchAuthText, { color: c.muted }, textDirection]}
          >
            {tr("alreadyHaveAccount")} {" "}
            <Text style={{ color: c.green, fontWeight: "800" }}>
              {tr("signIn")}
            </Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => setPage("home")} style={styles.guestButton}>
          <Text style={[styles.guestText, { color: c.ink }]}>
            {tr("continueDemo")}
          </Text>
        </Pressable>
        <Text
          style={[styles.authNote, { color: c.muted, textAlign: "center" }]}
        >
          {tr("changeLanguage")}
        </Text>
        <View style={[styles.welcomeLanguages, { flexDirection: "row" }]}>
          {languages.map((item) => (
            <Pressable key={item} onPress={() => setLanguage(item)}>
              <Text
                style={[
                  styles.languageTiny,
                  { color: language === item ? c.green : c.muted },
                ]}
              >
                {item === "ar"
                  ? "العربية"
                  : item === "fr"
                    ? "Français"
                    : "English"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const VehicleContent = () => (
    <View style={{ gap: 20 }}>
      <Pressable
        onPress={() => setPage("home")}
        style={[styles.backButton, { flexDirection: direction }]}
      >
        <Ionicons
          name={isRTL ? "arrow-forward" : "arrow-back"}
          size={20}
          color={c.ink}
        />
        <Text style={[styles.backText, { color: c.ink }]}>{tr("back")}</Text>
      </Pressable>
      <View style={[styles.pageIntro, { flexDirection: direction }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: c.ink }, textDirection]}>
            {tr("editVehicle")}
          </Text>
          <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
            {tr("currentCar")}
          </Text>
        </View>
        <View style={[styles.roundIcon, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="car-sport-outline" size={24} color={c.green} />
        </View>
      </View>
      {(
        [
          ["brand", tr("brandName")],
          ["model", tr("model")],
          ["year", tr("year")],
          ["mileage", tr("mileage")],
        ] as const
      ).map(([key, label]) => (
        <View key={key} style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
            {label}
          </Text>
          <TextInput
            value={vehicle[key]}
            onChangeText={(value) =>
              setVehicle((car) => ({ ...car, [key]: value }))
            }
            keyboardType={
              key === "year" || key === "mileage" ? "number-pad" : "default"
            }
            textAlign={isRTL ? "right" : "left"}
            style={[
              styles.input,
              { color: c.ink, backgroundColor: c.surface, borderColor: c.line },
            ]}
          />
        </View>
      ))}
      <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
        {tr("fuelType")}
      </Text>
      <View
        style={[
          styles.languageCard,
          {
            flexDirection: direction,
            backgroundColor: c.surface,
            borderColor: c.line,
          },
        ]}
      >
        {(["diesel", "petrol", "lpg"] as const).map((fuel) => (
          <Pressable
            key={fuel}
            onPress={() => setVehicle((car) => ({ ...car, fuel }))}
            style={[
              styles.languageOption,
              {
                flex: 1,
                backgroundColor: vehicle.fuel === fuel ? c.dark : c.bg,
                borderColor: vehicle.fuel === fuel ? c.dark : c.line,
              },
            ]}
          >
            <Text
              style={[
                styles.languageOptionText,
                { color: vehicle.fuel === fuel ? "#FFFFFF" : c.ink },
              ]}
            >
              {tr(fuel)}
            </Text>
          </Pressable>
        ))}
      </View>
      {PrimaryButton({
        label: tr("save"),
        onPress: () => {
          const profile: AccountProfile = { firstName, lastName, vehicle };
          const error = validateAccountProfile(profile);
          if (error) {
            setRegistrationError(tr(error));
            return;
          }
          setRegistrationError("");
          AsyncStorage.setItem("sayarti.accountProfile", JSON.stringify(profile)).catch(() => {
            setRegistrationError(tr("profileSaveError"));
          });
          setPage("home");
          showNotice();
        },
        icon: "checkmark-outline",
      })}
      {registrationError ? (
        <Text accessibilityRole="alert" style={[styles.formError, { color: c.red }, textDirection]}>
          {registrationError}
        </Text>
      ) : null}
    </View>
  );

  const pageTitle: Record<TabPage, TranslationKey> = {
    home: "home",
    maintenance: "maintenance",
    expenses: "expenses",
    documents: "documents",
    settings: "settings",
  };
  const renderMainContent = () => {
    if (page === "home") return HomeContent();
    if (page === "maintenance") return MaintenanceContent();
    if (page === "expenses") return ExpensesContent();
    if (page === "documents") return DocumentsContent();
    return SettingsContent();
  };

  const formTitle = editingTarget
    ? tr("editRecord")
    : formKind === "maintenance"
      ? tr("formMaintenance")
      : formKind === "servicePlan"
        ? tr("formServicePlan")
        : formKind === "expense"
          ? tr("formExpense")
          : formKind === "fuel"
            ? tr("formFuel")
            : tr("formDocument");
  const formFields: {
    key: keyof Draft;
    label: TranslationKey;
    numeric?: boolean;
  }[] =
    formKind === "maintenance"
      ? [
          { key: "title", label: "maintenance" },
          { key: "date", label: "serviceDate" },
          { key: "mileage", label: "mileage", numeric: true },
          { key: "amount", label: "cost", numeric: true },
          { key: "detail", label: "notes" },
        ]
      : formKind === "expense"
        ? [
            { key: "title", label: "expenseName" },
            { key: "amount", label: "amount", numeric: true },
            { key: "date", label: "serviceDate" },
            { key: "detail", label: "notes" },
          ]
        : formKind === "servicePlan"
          ? [
              { key: "title", label: "servicePlanTitle" },
              { key: "mileage", label: "remainingDistance", numeric: true },
            ]
          : formKind === "fuel"
          ? [
              { key: "amount", label: "amount", numeric: true },
              { key: "liters", label: "litersCount", numeric: true },
              { key: "price", label: "pricePerLiter", numeric: true },
              { key: "mileage", label: "mileage", numeric: true },
              { key: "date", label: "serviceDate" },
            ]
          : [
              { key: "title", label: "documentType" },
              { key: "date", label: "expiryDate" },
            ];

  const showTabs =
    page !== "welcome" &&
    page !== "login" &&
    page !== "register" &&
    page !== "vehicle";
  const content =
    page === "welcome" ? (
      WelcomeContent()
    ) : page === "login" || page === "register" ? (
      AuthContent({ register: page === "register" })
    ) : page === "vehicle" ? (
      VehicleContent()
    ) : (
      <>
        {Header({ title: tr(pageTitle[page as TabPage]) })}
        <ScrollView
          key={page}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.contentColumn}>{renderMainContent()}</View>
        </ScrollView>
        {showTabs ? (
          <View
            style={[
              styles.bottomNavWrap,
              {
                paddingBottom: Math.max(insets.bottom, 8),
                borderTopColor: c.line,
                backgroundColor: c.surface,
              },
            ]}
          >
            <View style={[styles.bottomNav, { flexDirection: direction }]}>
              {tabItems.map((item) => {
                const selected = page === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => startTab(item.id)}
                    style={styles.tabItem}
                    accessibilityRole="button"
                    accessibilityLabel={tr(item.key)}
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[
                        styles.tabIconBox,
                        {
                          backgroundColor: selected
                            ? c.greenSoft
                            : "transparent",
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={selected ? c.green : c.muted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.tabText,
                        { color: selected ? c.dark : c.muted },
                      ]}
                    >
                      {tr(item.key)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </>
    );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.root, { backgroundColor: c.bg }]}
    >
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      {content}
      {notice ? (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              bottom: Math.max(insets.bottom, 12) + (showTabs ? 76 : 18),
              backgroundColor: c.dark,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#9ACC4D" />
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      ) : null}
      <Modal
        visible={!!formKind}
        transparent
        animationType="slide"
        onRequestClose={() => setFormKind(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setFormKind(null)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: c.surface,
                paddingBottom: Math.max(insets.bottom, 18),
              },
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: c.line }]} />
            <View style={[styles.modalHeader, { flexDirection: direction }]}>
              <Text
                style={[styles.modalTitle, { color: c.ink }, textDirection]}
              >
                {formTitle}
              </Text>
              <Pressable
                onPress={() => setFormKind(null)}
                style={[
                  styles.roundButton,
                  { backgroundColor: c.bg, borderColor: c.line },
                ]}
              >
                <Ionicons name="close" size={19} color={c.ink} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {formFields.map((item) =>
                field(
                  item.key,
                  item.label,
                  item.key === "date" ? "08/10/2026" : "",
                  item.numeric,
                ),
              )}
              {formKind === "expense" ? (
                <View style={{ gap: 8, marginBottom: 14 }}>
                  <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
                    {tr("expenseCategory")}
                  </Text>
                  <View style={{ flexDirection: direction, flexWrap: "wrap", gap: 8 }}>
                    {(["fuelCategory", "serviceCategory", "partsCategory", "otherCategory"] as const).map((category) => {
                      const selected = draft.category === category;
                      return (
                        <Pressable
                          key={category}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setDraft((current) => ({ ...current, category }))}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 18,
                            backgroundColor: selected ? c.greenSoft : c.bg,
                            borderWidth: 1,
                            borderColor: selected ? c.green : c.line,
                          }}
                        >
                          <Text style={{ color: selected ? c.green : c.ink, fontSize: 12, fontWeight: "700" }}>
                            {tr(category)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {formKind === "document" ? (
                <View style={{ gap: 8, marginBottom: 14 }}>
                  <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
                    {tr("documentStatus")}
                  </Text>
                  <View style={{ flexDirection: direction, flexWrap: "wrap", gap: 8 }}>
                    {([
                      { value: "valid", label: "valid" },
                      { value: "soon", label: "dueSoon" },
                      { value: "stored", label: "stored" },
                    ] as const).map((status) => {
                      const selected = draft.detail === status.value;
                      return (
                        <Pressable
                          key={status.value}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setDraft((current) => ({ ...current, detail: status.value }))}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 18,
                            backgroundColor: selected ? c.greenSoft : c.bg,
                            borderWidth: 1,
                            borderColor: selected ? c.green : c.line,
                          }}
                        >
                          <Text style={{ color: selected ? c.green : c.ink, fontSize: 12, fontWeight: "700" }}>
                            {tr(status.label)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {formKind === "maintenance" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setInvoiceAttached((attached) => !attached)}
                  style={[styles.uploadButton, { flexDirection: direction, borderColor: c.line, backgroundColor: c.surfaceSoft }]}
                >
                  <Ionicons name={invoiceAttached ? "checkmark-done-outline" : "attach-outline"} size={19} color={invoiceAttached ? c.green : c.ink} />
                  <Text style={[styles.inlineHintText, { color: invoiceAttached ? c.green : c.ink }, textDirection]}>
                    {invoiceAttached ? tr("invoiceAdded") : tr("invoice")}
                  </Text>
                </Pressable>
              ) : null}
              {formKind === "fuel" ? (
                <View
                  style={[styles.inlineHint, { backgroundColor: c.blueSoft }]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={c.blue}
                  />
                  <Text
                    style={[
                      styles.inlineHintText,
                      { color: c.ink },
                      textDirection,
                    ]}
                  >
                    {tr("consumption")}: 6.4 L / 100 km
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={saveForm}
                style={[
                  styles.authButton,
                  { backgroundColor: c.green, marginTop: 10 },
                ]}
              >
                <Text style={styles.authButtonText}>{tr("save")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={!!scheduleTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduleTarget(null)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: "center", padding: 20 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={tr("close")}
            onPress={() => setScheduleTarget(null)}
          />
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", borderRadius: 22, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, gap: 14 }}>
            <Text style={[styles.modalTitle, { color: c.ink }, textDirection]}>
              {tr("scheduleReminder")}
            </Text>
            <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
              {scheduleTarget?.title}
            </Text>
            <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
              {tr("reminderDate")}
            </Text>
            <ReminderDateTimePicker
              key={scheduleOpenId}
              value={reminderDateTime}
              onChange={(value) => {
                setReminderDateTime(value);
                setScheduleError("");
              }}
              onValidityChange={(valid) => {
                setScheduleInputValid(valid);
                if (valid) setScheduleError("");
              }}
              language={language}
              isRTL={isRTL}
              labels={{
                date: tr("reminderDate"),
                time: tr("reminderTime"),
                dateInputHint: tr("dateInputHint"),
                timeInputHint: tr("timeInputHint"),
              }}
              colors={{
                ink: c.ink,
                muted: c.muted,
                surface: c.surface,
                line: c.line,
                green: c.green,
              }}
            />
            <Text style={[styles.fieldLabel, { color: c.ink }, textDirection]}>
              {tr("reminderSound")}
            </Text>
            <View style={{ flexDirection: direction, flexWrap: "wrap", gap: 8 }}>
              {reminderSoundIds.map((soundId) => {
                const selected = selectedReminderSound === soundId;
                return (
                  <Pressable
                    key={soundId}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedReminderSound(soundId)}
                    style={[
                      styles.recordActionButton,
                      {
                        flexDirection: direction,
                        backgroundColor: selected ? c.greenSoft : c.surface,
                        borderColor: selected ? c.green : c.line,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={16}
                      color={selected ? c.green : c.muted}
                    />
                    <Text
                      style={[
                        styles.recordActionText,
                        { color: selected ? c.green : c.ink },
                      ]}
                    >
                      {tr(reminderSoundTranslationKeys[soundId])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {Platform.OS === "web" ? (
              <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
                {tr("webSoundNote")}
              </Text>
            ) : null}
            {scheduleError ? (
              <Text style={[styles.formError, { color: c.red }, textDirection]}>
                {scheduleError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={saveSelectedReminder}
              style={[styles.authButton, { backgroundColor: c.green }]}
            >
              <Text style={styles.authButtonText}>{tr("saveReminder")}</Text>
            </Pressable>
            {scheduleTarget && reminders.find((item) => item.key === makeReminderKey(scheduleTarget.kind, scheduleTarget.recordId)) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => clearReminder(scheduleTarget)}
                style={[styles.recordActionButton, { flexDirection: direction, backgroundColor: c.surface, borderColor: c.line, alignSelf: "flex-start" }]}
              >
                <Ionicons name="close-circle-outline" size={16} color="#D65345" />
                <Text style={[styles.recordActionText, { color: "#D65345" }]}>
                  {tr("removeReminder")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: "center", padding: 20 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={tr("cancel")}
            onPress={() => setDeleteTarget(null)}
          />
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", borderRadius: 22, padding: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, gap: 12 }}>
            <Text style={[styles.modalTitle, { color: c.ink }, textDirection]}>
              {tr("deleteRecord")}
            </Text>
            <Text style={[styles.bodyText, { color: c.muted }, textDirection]}>
              {deleteTarget?.title} · {tr("deleteConfirm")}
            </Text>
            <View style={{ flexDirection: direction, gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDeleteTarget(null)}
                style={[styles.authButton, { backgroundColor: c.surfaceSoft, borderWidth: 1, borderColor: c.line, flex: 1 }]}
              >
                <Text style={[styles.recordActionText, { color: c.ink }]}>
                  {tr("cancel")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirmDelete}
                style={[styles.authButton, { backgroundColor: "#D65345", flex: 1 }]}
              >
                <Text style={styles.authButtonText}>{tr("deleteRecord")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  brandRow: { alignItems: "center", gap: 10 },
  brandName: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  eyebrow: { fontSize: 10, fontWeight: "600" },
  headerActions: { alignItems: "center", gap: 8 },
  recordActions: {
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  recordActionButton: {
    minHeight: 32,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  recordActionText: { fontSize: 10, fontWeight: "800" },
  scheduledReminderRow: {
    padding: 12,
    gap: 9,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reminderCancelButton: {
    minHeight: 31,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reminderCancelText: { fontSize: 9, fontWeight: "700" },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 5,
    top: 7,
    right: 7,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 122 },
  contentColumn: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 18 },
  welcomeLine: { alignItems: "center", gap: 10, marginBottom: 0 },
  greeting: { fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  bodyText: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  demoBadge: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 99,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 4 },
  demoBadgeText: { fontSize: 9, fontWeight: "800" },
  vehicleCard: {
    minHeight: 140,
    padding: 17,
    borderRadius: 24,
    alignItems: "center",
    gap: 13,
    overflow: "hidden",
  },
  carOrb: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "#114722",
    alignItems: "center",
    justifyContent: "center",
  },
  carTopline: { alignItems: "center", gap: 8 },
  carMake: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  carTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#174F2A",
  },
  carTagText: { color: "#D0E9B6", fontSize: 10, fontWeight: "800" },
  carMeta: { color: "#D8E9D3", fontSize: 12, fontWeight: "600" },
  odometerTrack: {
    height: 4,
    width: "100%",
    backgroundColor: "#0D3A22",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 2,
  },
  odometerFill: {
    height: 4,
    width: "66%",
    backgroundColor: "#619B15",
    borderRadius: 4,
  },
  odometerHint: { color: "#B6D69B", fontSize: 10, fontWeight: "600" },
  alertCard: {
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  alertIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontSize: 11, fontWeight: "700" },
  alertValue: { fontSize: 15, fontWeight: "800" },
  alertSub: { fontSize: 11, fontWeight: "600" },
  alertChevron: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: "#FFFFFF70",
    alignItems: "center",
    justifyContent: "center",
  },
  statRow: { gap: 10 },
  infoCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 19,
    borderWidth: 1,
    padding: 13,
    gap: 7,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { fontSize: 10, fontWeight: "700" },
  infoValue: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  sectionHeading: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  actionText: { fontSize: 11, fontWeight: "800" },
  quickRow: { gap: 8 },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 7,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  reminderCard: { borderRadius: 19, borderWidth: 1, paddingHorizontal: 13 },
  reminderRow: {
    minHeight: 68,
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 12, fontWeight: "800" },
  rowSub: { fontSize: 10, lineHeight: 15, fontWeight: "500" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 },
  statusText: { fontSize: 8, fontWeight: "800" },
  yearCard: { borderRadius: 20, borderWidth: 1, padding: 15, gap: 13 },
  yearHead: { alignItems: "center", justifyContent: "space-between" },
  yearTotal: { fontSize: 22, fontWeight: "900", letterSpacing: -0.7 },
  roundIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  barTrack: {
    height: 9,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#E9EFEC",
  },
  barFill: { height: 9 },
  legendRow: { flexWrap: "wrap", justifyContent: "space-between", gap: 5 },
  perKmRow: {
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  perKmValue: { fontSize: 13, fontWeight: "900" },
  legendText: { fontSize: 9, fontWeight: "600" },
  pageIntro: { alignItems: "center", gap: 12, marginBottom: 1 },
  pageTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  lastServiceCard: { padding: 15, borderWidth: 1, borderRadius: 20, gap: 13 },
  lastServiceHead: { alignItems: "center", gap: 10 },
  lastServiceMeta: {
    justifyContent: "space-between",
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5ECE8",
  },
  serviceRow: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
    alignItems: "center",
    gap: 11,
  },
  rowIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  listCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12 },
  expenseRow: {
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moneySmall: { fontSize: 11, fontWeight: "800" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 2,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  expenseHero: {
    borderRadius: 23,
    padding: 20,
    minHeight: 150,
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  heroLabel: { color: "#D8E9D3", fontSize: 11, fontWeight: "700" },
  heroAmount: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroMeta: {
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF2A",
    paddingTop: 11,
    marginTop: 2,
  },
  heroMetaText: { color: "#C9DFAF", fontSize: 10, fontWeight: "600" },
  categoryRow: {
    minHeight: 65,
    borderRadius: 17,
    borderWidth: 1,
    padding: 10,
    gap: 9,
    alignItems: "center",
  },
  documentAlert: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    alignItems: "center",
    gap: 9,
  },
  documentAlertText: { fontSize: 12, fontWeight: "700" },
  documentRow: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    alignItems: "center",
  },
  noteCard: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noteText: { flex: 1, fontSize: 10, fontWeight: "600" },
  languageCard: { borderRadius: 18, padding: 10, borderWidth: 1, gap: 8 },
  languageOption: {
    minHeight: 41,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  languageOptionText: { fontSize: 11, fontWeight: "800" },
  settingRow: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    gap: 11,
    alignItems: "center",
  },
  profileCard: { borderWidth: 1, borderRadius: 18, padding: 13, gap: 10 },
  profileHint: { fontSize: 10, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === "web" ? 11 : 13,
    fontSize: 13,
    minHeight: 47,
  },
  urlInput: { fontSize: 12 },
  openLinkButton: {
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  openLinkText: { fontSize: 11, fontWeight: "800" },
  premiumCard: { borderRadius: 22, padding: 17, gap: 10, overflow: "hidden" },
  premiumTop: { alignItems: "center", gap: 8 },
  premiumIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", flex: 1 },
  premiumTag: {
    backgroundColor: "#114722",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  premiumTagText: {
    color: "#D0E98E",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  premiumTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  premiumDesc: { color: "#D8E9D3", fontSize: 11, lineHeight: 17 },
  premiumFooter: {
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF25",
    paddingTop: 10,
    marginTop: 3,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  premiumPrice: { color: "#FED439", fontSize: 12, fontWeight: "900" },
  previewOnly: {
    color: "#C9DFAF",
    fontSize: 8,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: { fontSize: 11, fontWeight: "800" },
  bottomNavWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
  },
  bottomNav: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 8,
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    minHeight: 53,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIconBox: {
    width: 34,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabText: { fontSize: 9, fontWeight: "700" },
  authScrollContent: { flexGrow: 1, paddingBottom: 24 },
  authWrap: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 14,
  },
  backButton: {
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    minHeight: 42,
  },
  backText: { fontSize: 12, fontWeight: "700" },
  authBrand: {
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    overflow: "hidden",
  },
  brandLogoPlate: {
    width: "100%",
    maxWidth: 330,
    aspectRatio: 1.5,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 7,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandLogoImage: { width: "100%", height: "100%" },
  authTitle: { fontSize: 23, fontWeight: "900", marginTop: 7 },
  authNote: { fontSize: 10, lineHeight: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "800" },
  signupSectionTitle: { fontSize: 12, fontWeight: "900" },
  fuelChipList: { gap: 8, flexWrap: "wrap" },
  fuelChip: {
    flex: 1,
    minWidth: 80,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fuelChipText: { fontSize: 11, fontWeight: "800" },
  formError: { fontSize: 11, lineHeight: 17, fontWeight: "700" },
  authButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 17,
  },
  authButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  switchAuth: { alignItems: "center", paddingVertical: 4 },
  switchAuthText: { fontSize: 11, fontWeight: "600" },
  guestButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  guestText: { fontSize: 11, fontWeight: "800" },
  welcomeWrap: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingBottom: 20,
    justifyContent: "center",
  },
  welcomeHero: {
    minHeight: 440,
    marginHorizontal: 18,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    overflow: "hidden",
    gap: 15,
  },
  welcomeGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 200,
    backgroundColor: "#114722",
    top: -90,
    right: -80,
  },
  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },
  welcomeSubtitle: {
    color: "#D8E9D3",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
  roadLine: { width: 74, height: 4, borderRadius: 4, marginTop: 12 },
  welcomeLanguages: { justifyContent: "center", gap: 17 },
  languageTiny: { fontSize: 10, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#061E22A8",
    justifyContent: "flex-end",
  },
  modalDismiss: { flex: 1 },
  modalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  inlineHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 10,
    borderRadius: 12,
    marginBottom: 7,
  },
  uploadButton: { gap: 10, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 14, padding: 14, marginTop: 10 },
  inlineHintText: { fontSize: 10, fontWeight: "700", flex: 1 },
  toast: {
    position: "absolute",
    alignSelf: "center",
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 20,
    maxWidth: "92%",
  },
  toastText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
});
