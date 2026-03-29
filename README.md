# The Mind Palace 🧠

An iOS-first personal cognitive organizer that helps you manage your thoughts, tasks, and ideas with AI-powered context classification.

## Features

- **3 Category System**: URGENT, HAVE, NICE
- **AI Context Classification**: Automatically organizes notes into meaningful contexts
- **Smart Notifications**: Context-aware reminders with intelligent scheduling
- **First-Time Setup**: Seed your initial contexts to train the AI
- **Auto-expanding Accordions**: See your newly classified notes instantly

## Architecture

- **Frontend**: React Native + Expo
- **State Management**: Zustand
- **Database**: SQLite (expo-sqlite)
- **AI**: OpenAI API (via local proxy server)
- **Tests**: Jest with comprehensive coverage

## Get started

### 1. Install dependencies

```bash
npm install
cd openrouter-proxy && npm install && cd ..
```

### 2. Set up environment variables

**Main App:**
```bash
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_AI_GATEWAY_URL and EXPO_PUBLIC_AI_PLAN
```

**OpenRouter Proxy:**
```bash
cd openrouter-proxy
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY from https://platform.openai.com/api-keys
```

### 3. Start the proxy server

```bash
cd openrouter-proxy
npm start
```

### 4. Start the Expo app

```bash
npx expo start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Expo Go](https://expo.dev/go)

## Project Structure

```
the-mind-palace/
├── app/                    # Main application code
│   ├── (tabs)/            # Tab screens (URGENT, HAVE, NICE)
│   ├── db/                # Database repositories
│   ├── services/          # Business logic
│   ├── store/             # Zustand state management
│   └── utils/             # Utilities and helpers
├── services/              # Shared services
│   └── context-engine/    # AI classification pipeline
├── openrouter-proxy/      # Proxy server for OpenRouter API
├── __tests__/             # Jest test suite
└── components/            # Reusable UI components
```

## Testing

```bash
npm test
```

All 22 tests should pass! ✅

## Product Rules

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for detailed product behavior and architecture decisions.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
