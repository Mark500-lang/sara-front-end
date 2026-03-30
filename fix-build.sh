#!/bin/bash

echo "🔧 Fixing Android Build and Crash Issues..."

cd /home/scarface/Desktop/sara-front-end

# 1. Create debug keystore if missing
echo "=== Creating Debug Keystore ==="
cd android/app
if [ ! -f debug.keystore ]; then
    keytool -genkey -v -keystore debug.keystore \
      -storepass android -alias androiddebugkey \
      -keypass android -keyalg RSA -keysize 2048 \
      -validity 10000 -dname "CN=Android Debug,O=Android,C=US" -noprompt
    echo "✅ debug.keystore created"
else
    echo "✅ debug.keystore exists"
fi
cd ../..

# 2. Fix MainActivity.java
echo ""
echo "=== Fixing MainActivity.java ==="
cat > android/app/src/main/java/com/littlestories/app/MainActivity.java << 'EOF'
package com.littlestories.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Capacitor handles everything automatically
}
EOF
echo "✅ MainActivity.java fixed"

# 3. Ensure MainApplication.java exists
echo ""
echo "=== Ensuring MainApplication.java ==="
mkdir -p android/app/src/main/java/com/littlestories/app/
cat > android/app/src/main/java/com/littlestories/app/MainApplication.java << 'EOF'
package com.littlestories.app;

import android.app.Application;

public class MainApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
    }
}
EOF
echo "✅ MainApplication.java ensured"

# 4. Sync Capacitor
echo ""
echo "=== Syncing Capacitor ==="
npx cap sync android

# 5. Build
echo ""
echo "=== Building Debug APK ==="
cd android
./gradlew clean assembleDebug --no-daemon

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Build Successful!"
    echo "📁 APK: app/build/outputs/apk/debug/app-debug.apk"
    
    # Check if device is connected
    echo ""
    echo "=== Device Check ==="
    if adb devices | grep -q "device$"; then
        echo "✅ Android device connected"
        echo "Installing APK..."
        adb install -r app/build/outputs/apk/debug/app-debug.apk
        echo "Launching app..."
        adb shell am start -n com.littlestories.app/.MainActivity
        echo ""
        echo "📱 App launched! Check device for crash."
        echo "To see logs: adb logcat -s Capacitor/Console"
    else
        echo "⚠️ No Android device connected"
        echo "Connect device or start emulator:"
        echo "  emulator -avd Pixel_4_API_34 &"
        echo "Then run: adb install app/build/outputs/apk/debug/app-debug.apk"
    fi
else
    echo "❌ Build failed"
    exit 1
fi