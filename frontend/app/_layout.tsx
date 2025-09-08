import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import ChatbotFloatingIcon from '../components/Chatbot';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const router = useRouter();

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="chatbot" 
          options={{ 
            title: "JalMitra Chat",
            presentation: 'modal'
          }} 
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <ChatbotFloatingIcon onPress={() => router.push('/explore')} style={undefined} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
