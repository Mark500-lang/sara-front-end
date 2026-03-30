#!/bin/bash

echo "🔧 Debugging Android Crash..."

cd /home/scarface/Desktop/sara-front-end

# 1. Check package consistency
echo "=== Package Check ==="
echo "Capacitor config:"
grep appId capacitor.config.json
echo ""
echo "Android build.gradle:"
grep -E "namespace|applicationId" android/app/build.gradle
echo ""
echo "AndroidManifest activities:"
grep "android:name=" android/app/src/main/AndroidManifest.xml

# 2. Check MainApplication exists
echo ""
echo "=== MainApplication Check ==="
if [ -f "android/app/src/main/java/com/littlestories/app/MainApplication.java" ]; then
    echo "✅ MainApplication.java exists"
    cat android/app/src/main/java/com/littlestories/app/MainApplication.java
else
    echo "❌ MainApplication.java MISSING!"
    echo "Creating basic MainApplication..."
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
fi

# 3. Build and test
echo ""
echo "=== Building Debug APK ==="
cd android
./gradlew clean assembleDebug

echo ""
echo "=== Installing and Testing ==="
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n com.littlestories.app/.MainActivity
echo "App launched. Check device for crash."
echo "Run 'adb logcat -v time *:E | grep -A 10 -B 5 littlestories' to see errors"