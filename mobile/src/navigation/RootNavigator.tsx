import React from "react";
import { Text } from "react-native";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth";
import { DashboardScreen } from "../screens/DashboardScreen";
import { WatchlistScreen } from "../screens/WatchlistScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { AlertFormScreen } from "../screens/AlertFormScreen";
import { SoundsScreen } from "../screens/SoundsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { AnalysisScreen } from "../screens/AnalysisScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { Spinner } from "../components/ui";
import type { RootStackParamList, TabParamList } from "./types";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    text: colors.text,
    primary: colors.primary,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: "📊",
    Watchlist: "📈",
    Alerts: "🔔",
    Settings: "⚙️",
  };
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{icons[label] ?? "•"}</Text>;
}

function TabsNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: "ภาพรวม" }} />
      <Tabs.Screen name="Watchlist" component={WatchlistScreen} options={{ title: "Watchlist" }} />
      <Tabs.Screen name="Alerts" component={AlertsScreen} options={{ title: "Alerts" }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: "ตั้งค่า" }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { ready, token } = useAuth();

  if (!ready) {
    return <Spinner label="กำลังเริ่มต้นแอป…" />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {token ? (
          <>
            <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
            <Stack.Screen
              name="AlertForm"
              component={AlertFormScreen}
              options={{ title: "Alert", presentation: "card" }}
            />
            <Stack.Screen name="Sounds" component={SoundsScreen} options={{ title: "เสียงแจ้งเตือน" }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: "ประวัติการแจ้งเตือน" }} />
            <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ title: "วิเคราะห์ราคาแนะนำ" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "โปรไฟล์" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "สมัครสมาชิก" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
