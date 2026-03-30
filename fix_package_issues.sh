#!/bin/bash
echo "=== Fixing Package Name Issues ==="
echo ""

cd /home/scarface/Desktop/sara-front-end

# 1. Update AndroidManifest.xml
echo "1. Fixing AndroidManifest.xml..."
cd android/app/src/main

# Remove old package attribute (AGP 8.5+ doesn't need it in manifest)
if grep -q 'package="com.littlestories.app"' AndroidManifest.xml; then
    echo "   Removing old package attribute..."
    sed -i 's/package="com.littlestories.app"//' AndroidManifest.xml
    echo "   ✅ Removed package attribute"
else
    echo "   ✅ No old package attribute found"
fi

# 2. Sync Capacitor to ensure all configs are updated
echo ""
echo "2. Syncing Capacitor configuration..."
cd /home/scarface/Desktop/sara-front-end
npx cap sync android

# 3. Check if we need to update any generated files
echo ""
echo "3. Checking generated files..."
cd android
if [ -f "app/src/main/java/com/littlestories/app/MainActivity.java" ]; then
    echo "   Found old package directory structure..."
    echo "   Updating to new package..."
    
    # Create new directory structure
    mkdir -p app/src/main/java/com/sarastories/app
    cp app/src/main/java/com/littlestories/app/* app/src/main/java/com/sarastories/app/ 2>/dev/null || true
    
    # Update package declaration in Java files
    find app/src/main/java/com/sarastories/app -name "*.java" -type f -exec sed -i 's/package com.littlestories.app/package com.sarastories.app/g' {} \;
    
    echo "   ✅ Updated package structure"
fi

# 4. Clean and build
echo ""
echo "4. Cleaning and building..."
./gradlew clean --no-daemon

echo ""
echo "5. Building debug version..."
if ./gradlew assembleDebug --no-daemon; then
    echo ""
    echo "✅ Debug build successful!"
    echo ""
    echo "6. Building release version..."
    if ./gradlew assembleRelease --no-daemon; then
        echo ""
        echo "🎉 SUCCESS! Both debug and release builds work!"
        echo ""
        echo "=== Build Summary ==="
        echo "Debug APK:   android/app/build/outputs/apk/debug/app-debug.apk"
        echo "Release APK: android/app/build/outputs/apk/release/app-release.apk"
        echo "Package:     com.sarastories.app"
        echo ""
        echo "✅ Ready for Huawei AppGallery submission!"
    else
        echo ""
        echo "⚠️  Debug works but release failed. Checking signing..."
        echo ""
        echo "Checking signing configuration:"
        grep -n -A 4 -B 4 "signingConfigs" app/build.gradle
        echo ""
        echo "Make sure you have:"
        echo "1. sarastories-release.keystore in android/ directory"
        echo "2. Correct passwords in app/build.gradle"
    fi
else
    echo ""
    echo "❌ Build failed. Checking errors..."
    ./gradlew assembleDebug --no-daemon --stacktrace 2>&1 | tail -50
fi
