import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0B1220',
      }}
    >
      <Stack.Screen name="index" options={{ title: '型一覧' }} />
      <Stack.Screen name="template/create" options={{ title: '型作成' }} />
      <Stack.Screen name="template/[id]" options={{ title: '型詳細' }} />
      <Stack.Screen
        name="camera/[templateId]"
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
