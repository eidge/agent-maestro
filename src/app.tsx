import { SplashScreen } from "./screens/SplashScreen";
import { useState } from "react";
import { MainScreen } from "./screens/MainScreen";

type ScreenName = "splash" | "main";

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("main");

  const onDismissSplashScreen = () => {
    setCurrentScreen("main");
  };

  switch (currentScreen) {
    case "splash":
      return <SplashScreen onDismiss={onDismissSplashScreen} />;
    case "main":
      return <MainScreen />;
  }
}
