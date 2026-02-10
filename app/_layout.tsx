import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.setOptions({
      duration: 120,
      fade: true,
    });

    const timer = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'FRAME' }} />
      <Stack.Screen name="template/create" options={{ title: '型を作る' }} />
      <Stack.Screen name="template/[templateId]" options={{ title: '型詳細' }} />
      <Stack.Screen name="camera/[templateId]" options={{ title: '撮影' }} />
    </Stack>
  );
}
