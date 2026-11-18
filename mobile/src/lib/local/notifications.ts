import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;

/** Configure the native notification presentation used by local price alerts. */
export async function configureLocalNotifications(): Promise<void> {
  if (configured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("price-alerts", {
      name: "Price alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 150, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  configured = true;
}

/** Ask once for permission. A denied permission never blocks price monitoring. */
export async function requestLocalNotificationPermission(): Promise<boolean> {
  await configureLocalNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function notifyPriceAlert(input: {
  title: string;
  body: string;
  alertId: string;
  eventId: string;
  symbol: string;
}): Promise<void> {
  try {
    const allowed = await requestLocalNotificationPermission();
    if (!allowed) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: "price-alerts" } : {}),
        data: { alertId: input.alertId, eventId: input.eventId, symbol: input.symbol },
      },
      trigger: null,
    });
  } catch (err) {
    // A notification failure must never stop price monitoring or sound playback.
    console.warn("[local-notifications] unable to show notification", err);
  }
}
