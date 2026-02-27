import { SplashScreen } from "./screens/splash";
import { useKeyboardShortcutRegistry } from "./hooks/keyboard";
import { useEffect, useState } from "react";
import { MainScreen } from "./screens/main";

type ScreenName = "splash" | "main"

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("splash")
  const shortcuts = useKeyboardShortcutRegistry()

  const onDismissSplashScreen = () => {
    setCurrentScreen("main")
  }

  useEffect(() => {
    console.log(shortcuts)
  }, [shortcuts])

  switch(currentScreen) {
    case 'splash':
      return <SplashScreen onDismiss={onDismissSplashScreen} />
    case 'main':
      return <MainScreen />
  }
}
