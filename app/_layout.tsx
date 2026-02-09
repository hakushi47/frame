import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'FRAME' }} />
      <Stack.Screen name="template/create" options={{ title: '型を作る' }} />
      <Stack.Screen name="template/[templateId]" options={{ title: '型詳細' }} />
      <Stack.Screen name="camera/[templateId]" options={{ title: '撮影' }} />
    </Stack>
  );
}
